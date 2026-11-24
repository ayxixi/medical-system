#!/usr/bin/env python3
"""Preview or safely append a medical-system ZIP backup to a local account."""

from __future__ import annotations

import argparse
import errno
import hashlib
import json
import math
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import unicodedata
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from verify_export_manifest import load_manifest, verify_archive


MAX_DATA_JSON_BYTES = 256 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024


def new_id() -> str:
    return f"imp_{uuid.uuid4().hex}"


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"备份结构无效：{label}")
    return value


def require_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"备份结构无效：{label}")
    return value


def require_string(value: Any, label: str, nullable: bool = False) -> str | None:
    if nullable and value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"备份结构无效：{label}")
    return value


def db_datetime(value: Any, label: str, nullable: bool = False) -> str | None:
    text = require_string(value, label, nullable)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"备份日期无效：{label}") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc)
    return parsed.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def nullable_number(value: Any, label: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        raise ValueError(f"备份数字无效：{label}")
    return value


def required_bool(value: Any, label: str) -> int:
    if not isinstance(value, bool):
        raise ValueError(f"备份布尔值无效：{label}")
    return int(value)


def enum_string(value: Any, label: str, allowed: set[str]) -> str:
    result = require_string(value, label)
    assert result is not None
    if result not in allowed:
        raise ValueError(f"备份枚举值无效：{label}")
    return result


def archive_segment(value: str, fallback: str) -> str:
    value = unicodedata.normalize("NFC", value)
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f]', "_", value)
    value = re.sub(r"\.{2,}", "_", value).strip().rstrip(". ")
    return value[:120] or fallback


def archive_attachment_path(user: dict[str, Any], visit: dict[str, Any], index: int, file: dict[str, Any]) -> str:
    user_name = require_string(user.get("name"), "成员名称")
    user_id = require_string(user.get("id"), "成员 ID")
    visit_id = require_string(visit.get("id"), "就诊 ID")
    hospital = require_string(visit.get("hospital"), "医院", nullable=True) or "visit"
    visit_date = db_datetime(visit.get("date"), "就诊日期")
    assert user_name is not None and user_id is not None and visit_id is not None and visit_date is not None
    day = datetime.strptime(visit_date[:10], "%Y-%m-%d").date().isoformat()
    original_name = require_string(file.get("originalName"), "附件名称")
    assert original_name is not None
    return "/".join((
        "attachments",
        f"{archive_segment(user_name, 'member')}-{archive_segment(user_id, 'id')}",
        f"{day}-{archive_segment(hospital, 'visit')}-{archive_segment(visit_id, 'id')}",
        f"{index + 1:03d}-{archive_segment(original_name, 'attachment')}",
    ))


def extension_for(original_name: str) -> str:
    suffix = PurePosixPath(original_name.replace("\\", "/")).suffix.lower()
    return suffix if re.fullmatch(r"\.[a-z0-9]{1,10}", suffix) else ""


def prepare_import(archive: zipfile.ZipFile) -> dict[str, Any]:
    verify_archive(archive)
    infos = {info.filename: info for info in archive.infolist() if not info.is_dir()}
    data_info = infos.get("data.json")
    if data_info is None or data_info.file_size > MAX_DATA_JSON_BYTES:
        raise ValueError("备份缺少 data.json 或数据文件超出安全上限")
    try:
        data = json.loads(archive.read(data_info).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("data.json 不是有效的 UTF-8 JSON") from error
    data = require_object(data, "根对象")
    version = data.get("schemaVersion")
    if isinstance(version, bool) or not isinstance(version, int) or version != 1:
        raise ValueError("不支持的账号数据版本")
    account = require_object(data.get("account"), "账号")
    require_string(account.get("id"), "导出账号 ID")
    require_string(account.get("email"), "导出账号邮箱")
    db_datetime(account.get("createdAt"), "导出账号创建时间")
    users = require_list(data.get("users"), "成员列表")

    manifest = load_manifest(archive, archive.infolist())
    manifest_by_name = {entry["path"]: entry for entry in manifest["files"]}
    expected_paths = {"data.json", "README.txt", "manifest.json"}
    user_plan: list[dict[str, Any]] = []
    file_plan: list[dict[str, Any]] = []
    source_user_ids: set[str] = set()
    source_visit_ids: set[str] = set()
    file_count = record_count = medication_count = health_log_count = reminder_count = visit_count = 0

    for user_value in users:
        user = require_object(user_value, "成员")
        source_user = require_string(user.get("id"), "成员 ID")
        name = require_string(user.get("name"), "成员名称")
        if source_user is None or name is None or source_user in source_user_ids:
            raise ValueError("备份成员 ID 缺失或重复")
        db_datetime(user.get("createdAt"), "成员创建时间")
        db_datetime(user.get("updatedAt"), "成员更新时间")
        source_user_ids.add(source_user)
        new_user = new_id()
        visits = require_list(user.get("visits"), "就诊列表")
        health_logs = require_list(user.get("healthLogs"), "病程列表")
        reminders = require_list(user.get("reminders"), "提醒列表")
        planned_visits: list[dict[str, Any]] = []

        for visit_value in visits:
            visit = require_object(visit_value, "就诊")
            source_visit = require_string(visit.get("id"), "就诊 ID")
            if source_visit is None or source_visit in source_visit_ids:
                raise ValueError("备份就诊 ID 缺失或重复")
            source_visit_ids.add(source_visit)
            new_visit = new_id()
            db_datetime(visit.get("createdAt"), "就诊创建时间")
            db_datetime(visit.get("updatedAt"), "就诊更新时间")
            require_string(visit.get("hospital"), "医院", nullable=True)
            require_string(visit.get("department"), "科室", nullable=True)
            require_string(visit.get("doctor"), "医生", nullable=True)
            require_string(visit.get("note"), "备注", nullable=True)
            records = require_list(visit.get("records"), "诊断列表")
            medications = require_list(visit.get("medications"), "用药列表")
            files = require_list(visit.get("files"), "附件列表")
            for record_value in records:
                record = require_object(record_value, "诊断")
                require_string(record.get("diagnosis"), "诊断内容")
                db_datetime(record.get("createdAt"), "诊断创建时间")
                db_datetime(record.get("updatedAt"), "诊断更新时间")
            for medication_value in medications:
                medication = require_object(medication_value, "用药")
                require_string(medication.get("name"), "药品名称")
                require_string(medication.get("dosage"), "剂量", nullable=True)
                require_string(medication.get("frequency"), "频次", nullable=True)
                require_string(medication.get("duration"), "疗程", nullable=True)
                db_datetime(medication.get("createdAt"), "用药创建时间")
                db_datetime(medication.get("updatedAt"), "用药更新时间")
            planned_files = []

            for index, file_value in enumerate(files):
                file = require_object(file_value, "附件")
                source_path = archive_attachment_path(user, visit, index, file)
                info = infos.get(source_path)
                manifest_entry = manifest_by_name.get(source_path)
                size = file.get("size")
                if (
                    info is None or manifest_entry is None
                    or isinstance(size, bool) or not isinstance(size, int) or size < 0
                    or size > 2_147_483_647 or info.file_size != size
                ):
                    raise ValueError("附件与数据清单不匹配")
                expected_paths.add(source_path)
                original_name = require_string(file.get("originalName"), "附件名称")
                mime_type = require_string(file.get("mimeType"), "附件 MIME 类型")
                created_at = db_datetime(file.get("createdAt"), "附件创建时间")
                updated_at = db_datetime(file.get("updatedAt"), "附件更新时间")
                assert original_name is not None and mime_type is not None
                stored_name = f"{uuid.uuid4().hex}{extension_for(original_name)}"
                relative_path = PurePosixPath(new_user, new_visit, stored_name).as_posix()
                planned_file = {
                    "info": info,
                    "manifest": manifest_entry,
                    "sourcePath": source_path,
                    "userId": new_user,
                    "visitId": new_visit,
                    "originalName": original_name,
                    "mimeType": mime_type,
                    "size": size,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "storedName": stored_name,
                    "relativePath": relative_path,
                }
                planned_files.append(planned_file)
                file_plan.append(planned_file)

            planned_visits.append({
                "source": visit,
                "id": new_visit,
                "records": records,
                "medications": medications,
                "files": planned_files,
            })
            visit_count += 1
            record_count += len(records)
            medication_count += len(medications)
            file_count += len(files)

        for log_value in health_logs:
            log = require_object(log_value, "病程")
            enum_string(log.get("type"), "病程类型", {"temperature", "medication", "symptom", "note"})
            db_datetime(log.get("occurredAt"), "病程时间")
            db_datetime(log.get("createdAt"), "病程创建时间")
            db_datetime(log.get("updatedAt"), "病程更新时间")
            temperature = nullable_number(log.get("temperature"), "体温")
            if temperature is not None and not 25 <= temperature <= 45:
                raise ValueError("备份体温超出允许范围")
            require_string(log.get("medicineName"), "药品", nullable=True)
            require_string(log.get("dosage"), "剂量", nullable=True)
            require_string(log.get("symptoms"), "症状", nullable=True)
            require_string(log.get("note"), "备注", nullable=True)

        for reminder_value in reminders:
            reminder = require_object(reminder_value, "提醒")
            enum_string(reminder.get("kind"), "提醒类型", {"temperature", "medication", "custom"})
            require_string(reminder.get("title"), "提醒标题")
            require_string(reminder.get("note"), "提醒备注", nullable=True)
            db_datetime(reminder.get("nextAt"), "提醒时间")
            local_time = require_string(reminder.get("localTime"), "本地时间", nullable=True)
            if local_time is not None and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", local_time):
                raise ValueError("备份提醒时间格式无效")
            require_string(reminder.get("timeZone"), "时区")
            required_bool(reminder.get("repeatDaily"), "每日重复")
            required_bool(reminder.get("isActive"), "提醒状态")
            db_datetime(reminder.get("snoozedUntil"), "延后时间", nullable=True)
            db_datetime(reminder.get("completedAt"), "完成时间", nullable=True)
            db_datetime(reminder.get("createdAt"), "提醒创建时间")
            db_datetime(reminder.get("updatedAt"), "提醒更新时间")

        health_log_count += len(health_logs)
        reminder_count += len(reminders)
        user_plan.append({
            "source": user,
            "id": new_user,
            "visits": planned_visits,
            "healthLogs": health_logs,
            "reminders": reminders,
        })

    archive_files = {name for name in infos}
    if archive_files != expected_paths:
        raise ValueError("ZIP 文件与病历数据结构不一致")

    return {
        "data": data,
        "users": user_plan,
        "files": file_plan,
        "counts": {
            "users": len(user_plan),
            "visits": visit_count,
            "diagnoses": record_count,
            "medications": medication_count,
            "healthLogs": health_log_count,
            "reminders": reminder_count,
            "attachments": file_count,
        },
    }


def connect_database(database: Path, read_only: bool) -> sqlite3.Connection:
    resolved = database.resolve(strict=True)
    if read_only:
        wal_path = Path(f"{resolved}-wal")
        if wal_path.exists() and wal_path.stat().st_size > 0:
            raise ValueError("SQLite WAL 尚有内容；请停止应用并使用已 checkpoint 的数据库副本")
        connection = sqlite3.connect(
            resolved.as_uri() + "?mode=ro&immutable=1", uri=True, timeout=30
        )
    else:
        connection = sqlite3.connect(resolved, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def resolve_account(connection: sqlite3.Connection, identifier: str) -> sqlite3.Row:
    rows = connection.execute(
        'SELECT id, username, email FROM "Account" WHERE id = ? OR username = ? OR email = ?',
        (identifier, identifier, identifier),
    ).fetchall()
    if len(rows) != 1:
        raise ValueError("目标账号不存在或标识不唯一")
    return rows[0]


def archive_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def duplicate_import(connection: sqlite3.Connection, account_id: str, digest: str) -> bool:
    row = connection.execute(
        'SELECT 1 FROM "AuditLog" WHERE accountId = ? AND action = ? AND resourceType = ? AND resourceId = ? LIMIT 1',
        (account_id, "BackupRestore.import", "Backup", digest),
    ).fetchone()
    return row is not None


def preview_counts(counts: dict[str, int], account_id: str, digest: str) -> None:
    print(f"目标账号 ID：{account_id}")
    for label, key in (
        ("家庭成员", "users"), ("就诊", "visits"), ("诊断", "diagnoses"),
        ("用药", "medications"), ("病程", "healthLogs"),
        ("提醒", "reminders"), ("附件", "attachments"),
    ):
        print(f"{label}：{counts[key]}")
    print(f"备份 SHA-256：{digest}")


def insert_row(connection: sqlite3.Connection, table: str, values: dict[str, Any]) -> None:
    columns = list(values)
    column_sql = ", ".join(f'"{column}"' for column in columns)
    placeholders = ", ".join("?" for _ in columns)
    connection.execute(
        f'INSERT INTO "{table}" ({column_sql}) VALUES ({placeholders})',
        [values[column] for column in columns],
    )


def insert_import_data(
    connection: sqlite3.Connection,
    plan: dict[str, Any],
    account_id: str,
    digest: str,
) -> None:
    for user in plan["users"]:
        source_user = user["source"]
        insert_row(connection, "User", {
            "id": user["id"],
            "accountId": account_id,
            "name": require_string(source_user.get("name"), "成员名称"),
            "createdAt": db_datetime(source_user.get("createdAt"), "成员创建时间"),
            "updatedAt": db_datetime(source_user.get("updatedAt"), "成员更新时间"),
        })

        for visit in user["visits"]:
            source_visit = visit["source"]
            insert_row(connection, "Visit", {
                "id": visit["id"],
                "userId": user["id"],
                "date": db_datetime(source_visit.get("date"), "就诊日期"),
                "hospital": require_string(source_visit.get("hospital"), "医院", nullable=True),
                "department": require_string(source_visit.get("department"), "科室", nullable=True),
                "doctor": require_string(source_visit.get("doctor"), "医生", nullable=True),
                "note": require_string(source_visit.get("note"), "备注", nullable=True),
                "createdAt": db_datetime(source_visit.get("createdAt"), "就诊创建时间"),
                "updatedAt": db_datetime(source_visit.get("updatedAt"), "就诊更新时间"),
            })
            for record_value in visit["records"]:
                record = require_object(record_value, "诊断")
                insert_row(connection, "DiagnosisRecord", {
                    "id": new_id(),
                    "visitId": visit["id"],
                    "diagnosis": require_string(record.get("diagnosis"), "诊断内容"),
                    "createdAt": db_datetime(record.get("createdAt"), "诊断创建时间"),
                    "updatedAt": db_datetime(record.get("updatedAt"), "诊断更新时间"),
                })
            for medication_value in visit["medications"]:
                medication = require_object(medication_value, "用药")
                insert_row(connection, "Medication", {
                    "id": new_id(),
                    "visitId": visit["id"],
                    "name": require_string(medication.get("name"), "药品名称"),
                    "dosage": require_string(medication.get("dosage"), "剂量", nullable=True),
                    "frequency": require_string(medication.get("frequency"), "频次", nullable=True),
                    "duration": require_string(medication.get("duration"), "疗程", nullable=True),
                    "createdAt": db_datetime(medication.get("createdAt"), "用药创建时间"),
                    "updatedAt": db_datetime(medication.get("updatedAt"), "用药更新时间"),
                })

        for health_log_value in user["healthLogs"]:
            health_log = require_object(health_log_value, "病程")
            insert_row(connection, "HealthLog", {
                "id": new_id(),
                "userId": user["id"],
                "type": enum_string(
                    health_log.get("type"), "病程类型",
                    {"temperature", "medication", "symptom", "note"},
                ),
                "occurredAt": db_datetime(health_log.get("occurredAt"), "病程时间"),
                "temperature": nullable_number(health_log.get("temperature"), "体温"),
                "medicineName": require_string(health_log.get("medicineName"), "药品", nullable=True),
                "dosage": require_string(health_log.get("dosage"), "剂量", nullable=True),
                "symptoms": require_string(health_log.get("symptoms"), "症状", nullable=True),
                "note": require_string(health_log.get("note"), "备注", nullable=True),
                "createdAt": db_datetime(health_log.get("createdAt"), "病程创建时间"),
                "updatedAt": db_datetime(health_log.get("updatedAt"), "病程更新时间"),
            })

        for reminder_value in user["reminders"]:
            reminder = require_object(reminder_value, "提醒")
            insert_row(connection, "HealthReminder", {
                "id": new_id(),
                "userId": user["id"],
                "kind": enum_string(
                    reminder.get("kind"), "提醒类型",
                    {"temperature", "medication", "custom"},
                ),
                "title": require_string(reminder.get("title"), "提醒标题"),
                "note": require_string(reminder.get("note"), "提醒备注", nullable=True),
                "nextAt": db_datetime(reminder.get("nextAt"), "提醒时间"),
                "localTime": require_string(reminder.get("localTime"), "本地时间", nullable=True),
                "timeZone": require_string(reminder.get("timeZone"), "时区"),
                "repeatDaily": required_bool(reminder.get("repeatDaily"), "每日重复"),
                "snoozedUntil": db_datetime(reminder.get("snoozedUntil"), "延后时间", nullable=True),
                "isActive": required_bool(reminder.get("isActive"), "提醒状态"),
                "completedAt": db_datetime(reminder.get("completedAt"), "完成时间", nullable=True),
                "createdAt": db_datetime(reminder.get("createdAt"), "提醒创建时间"),
                "updatedAt": db_datetime(reminder.get("updatedAt"), "提醒更新时间"),
            })

    for file in plan["files"]:
        insert_row(connection, "VisitFile", {
            "id": new_id(),
            "visitId": file["visitId"],
            "originalName": file["originalName"],
            "storedName": file["storedName"],
            "relativePath": file["relativePath"],
            "mimeType": file["mimeType"],
            "size": file["size"],
            "storageProvider": "local",
            "createdAt": file["createdAt"],
            "updatedAt": file["updatedAt"],
        })

    insert_row(connection, "AuditLog", {
        "id": new_id(),
        "accountId": account_id,
        "action": "BackupRestore.import",
        "resourceType": "Backup",
        "resourceId": digest,
        "method": "CLI",
        "statusCode": 201,
        "succeeded": 1,
    })


def stage_attachments(
    archive: zipfile.ZipFile,
    plan: dict[str, Any],
    upload_root: Path,
    stage_root: Path,
) -> None:
    for index, file in enumerate(plan["files"]):
        digest = hashlib.sha256()
        size = 0
        stage_path = stage_root / f"file-{index:08d}.part"
        with archive.open(file["info"], "r") as source, stage_path.open("xb") as destination:
            while chunk := source.read(CHUNK_SIZE):
                destination.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        if size != file["size"] or digest.hexdigest() != file["manifest"]["sha256"]:
            raise ValueError("附件暂存时校验失败，未写入数据库")
        file["stagePath"] = stage_path
        file["destination"] = upload_root.joinpath(*PurePosixPath(file["relativePath"]).parts)


def prepare_destination(upload_root: Path, destination: Path) -> None:
    try:
        relative_parent = destination.parent.relative_to(upload_root)
    except ValueError as error:
        raise ValueError("附件目标路径超出存储目录") from error
    current = upload_root
    for part in relative_parent.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("附件目标路径包含符号链接")
        current.mkdir(exist_ok=True)
        if not current.resolve(strict=True).is_relative_to(upload_root):
            raise ValueError("附件目标路径超出存储目录")


def apply_import(
    database: Path,
    account_identifier: str,
    digest: str,
    plan: dict[str, Any],
    archive: zipfile.ZipFile,
    upload_root: Path,
) -> None:
    moved_files: list[Path] = []
    stage_root: Path | None = None
    committed = False
    connection = connect_database(database, read_only=False)
    try:
        connection.execute("BEGIN IMMEDIATE")
        account = resolve_account(connection, account_identifier)
        if duplicate_import(connection, account["id"], digest):
            raise ValueError("此 ZIP 备份已导入过，停止操作以避免重复数据")

        stage_root = Path(tempfile.mkdtemp(prefix=".restore-stage-", dir=upload_root))
        stage_attachments(archive, plan, upload_root, stage_root)
        insert_import_data(connection, plan, account["id"], digest)
        for file in plan["files"]:
            destination: Path = file["destination"]
            prepare_destination(upload_root, destination)
            if destination.exists() or destination.is_symlink():
                raise ValueError("附件目标路径已存在或不安全，已停止恢复")
            stage_path: Path = file["stagePath"]
            try:
                os.link(stage_path, destination)
                moved_files.append(destination)
                stage_path.unlink()
            except OSError as error:
                if destination.exists() or destination.is_symlink():
                    raise ValueError("附件目标路径已存在或不安全，已停止恢复") from error
                if error.errno not in {
                    errno.EXDEV, errno.EPERM, errno.EACCES,
                    getattr(errno, "EOPNOTSUPP", errno.EPERM),
                    getattr(errno, "ENOTSUP", errno.EPERM),
                }:
                    raise
                with stage_path.open("rb") as source:
                    with destination.open("xb") as target:
                        moved_files.append(destination)
                        shutil.copyfileobj(source, target, CHUNK_SIZE)
                stage_path.unlink()
        connection.commit()
        committed = True
    except Exception:
        if not committed:
            connection.rollback()
            for path in moved_files:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
        raise
    finally:
        connection.close()
        if stage_root is not None:
            try:
                shutil.rmtree(stage_root)
            except OSError:
                if committed:
                    print("警告：恢复已提交，但暂存目录未能清理，请检查附件目录中的 .restore-stage-*。", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path, help="本系统账号 ZIP 备份")
    parser.add_argument("--database", required=True, type=Path, help="目标 SQLite 数据库")
    parser.add_argument("--uploads", required=True, type=Path, help="目标本地附件目录")
    parser.add_argument("--account", required=True, help="目标账号 ID、用户名或邮箱")
    parser.add_argument("--apply", action="store_true", help="确认后追加恢复；默认仅预览")
    args = parser.parse_args()

    try:
        upload_root_arg = args.uploads
        if upload_root_arg.is_symlink():
            raise ValueError("附件目录不能是符号链接")
        upload_root = upload_root_arg.resolve(strict=True)
        if not upload_root.is_dir():
            raise ValueError("附件目录不存在或不是目录")
        digest = archive_digest(args.archive)
        with zipfile.ZipFile(args.archive, "r") as archive:
            plan = prepare_import(archive)
            connection = connect_database(args.database, read_only=True)
            try:
                account = resolve_account(connection, args.account)
                if duplicate_import(connection, account["id"], digest):
                    raise ValueError("此 ZIP 备份已导入过，停止操作以避免重复数据")
                preview_counts(plan["counts"], account["id"], digest)
            finally:
                connection.close()

            if not args.apply:
                print("预览完成：没有修改数据库或附件。应用时请先停止应用并完成备份，再添加 --apply。")
                return 0

            print("即将向目标账号追加记录和附件；已有记录与文件不会删除或覆盖。")
            print("请确认应用已停止运行，并已备份目标数据库和附件目录。")
            if input('确认恢复请输入 RESTORE：').strip() != "RESTORE":
                print("未确认，未修改数据库或附件。")
                return 3

            apply_import(args.database, args.account, digest, plan, archive, upload_root)
        print("恢复完成：导入数据已追加，原有数据保留。")
        return 0
    except ValueError as error:
        print(f"恢复失败：{error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(
            f"恢复失败：{type(error).__name__}。请确认归档、数据库迁移状态、目录权限和磁盘空间；未输出附件名或病历正文。",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
