#!/usr/bin/env python3
"""Read-only inventory of local attachment references and files."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import stat
import sys
from pathlib import Path, PurePosixPath
from typing import Any


def connect_read_only(database: Path) -> sqlite3.Connection:
    uri = database.resolve(strict=True).as_uri() + "?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def safe_relative_path(root: Path, value: str) -> tuple[Path | None, str | None]:
    if "\\" in value:
        return None, "反斜杠路径"
    if value.startswith("/") or any(part in ("", ".", "..") for part in value.split("/")):
        return None, "绝对路径或路径穿越"
    relative = PurePosixPath(value)
    if relative.is_absolute() or not relative.parts:
        return None, "绝对路径或路径穿越"
    candidate = root.joinpath(*relative.parts)
    try:
        candidate.relative_to(root)
    except ValueError:
        return None, "路径超出附件目录"

    current = root
    for part in relative.parts:
        current = current / part
        try:
            if current.is_symlink():
                return None, "路径包含符号链接"
        except OSError:
            return None, "无法检查路径"
    return candidate, None


def scan_files(root: Path) -> tuple[set[str], list[str], list[str]]:
    files: set[str] = set()
    skipped_symlinks: list[str] = []
    warnings: list[str] = []

    def raise_walk_error(error: OSError) -> None:
        raise error

    for current, dirnames, filenames in os.walk(
        root, followlinks=False, onerror=raise_walk_error
    ):
        current_path = Path(current)
        kept_dirs = []
        for name in dirnames:
            item = current_path / name
            if item.is_symlink():
                skipped_symlinks.append(item.relative_to(root).as_posix())
            else:
                kept_dirs.append(name)
        dirnames[:] = kept_dirs

        for name in filenames:
            item = current_path / name
            relative = item.relative_to(root).as_posix()
            try:
                info = item.lstat()
            except OSError as error:
                warnings.append(f"{relative}: 无法读取目录项（{error.strerror or error.__class__.__name__}）")
                continue
            if stat.S_ISLNK(info.st_mode):
                skipped_symlinks.append(relative)
            elif stat.S_ISREG(info.st_mode):
                files.add(relative)

    return files, sorted(set(skipped_symlinks)), sorted(warnings)


def build_report(database: Path, upload_root: Path) -> dict[str, Any]:
    root = upload_root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("附件目录不是目录")

    connection = connect_read_only(database)
    try:
        rows = connection.execute(
            "SELECT relativePath, storedName, storageProvider FROM VisitFile"
        ).fetchall()
        cleanup_rows = connection.execute(
            "SELECT relativePath, storageProvider FROM AttachmentCleanup"
        ).fetchall()
    finally:
        connection.close()

    local_refs: set[str] = set()
    missing: list[str] = []
    path_mismatches: list[dict[str, str]] = []
    s3_references = 0

    for row in rows:
        relative = str(row["relativePath"])
        provider = str(row["storageProvider"])
        if provider != "local":
            if provider == "s3":
                s3_references += 1
            continue

        candidate, error = safe_relative_path(root, relative)
        if error:
            path_mismatches.append({"path": relative, "reason": error})
            continue
        local_refs.add(PurePosixPath(relative).as_posix())
        if PurePosixPath(relative).name != str(row["storedName"]):
            path_mismatches.append({"path": relative, "reason": "storedName 与路径文件名不一致"})
        elif candidate is None:
            path_mismatches.append({"path": relative, "reason": "无法解析数据库路径"})
        else:
            try:
                candidate_info = candidate.stat()
            except FileNotFoundError:
                missing.append(relative)
            except OSError as error:
                path_mismatches.append({
                    "path": relative,
                    "reason": f"无法检查文件（{error.strerror or error.__class__.__name__}）",
                })
            else:
                if not stat.S_ISREG(candidate_info.st_mode):
                    path_mismatches.append({"path": relative, "reason": "路径目标不是普通文件"})

    cleanup_paths: set[str] = set()
    cleanup_report: list[dict[str, str]] = []
    for row in cleanup_rows:
        relative = str(row["relativePath"])
        if str(row["storageProvider"]) != "local":
            continue
        candidate, error = safe_relative_path(root, relative)
        if error:
            cleanup_report.append({"path": relative, "status": "路径不安全，未检查"})
        elif candidate is not None and candidate.is_file():
            normalized = PurePosixPath(relative).as_posix()
            cleanup_paths.add(normalized)
            cleanup_report.append({"path": normalized, "status": "清理队列待处理，单独列出"})

    disk_files, skipped_symlinks, scan_warnings = scan_files(root)
    pending_cleanup_files = disk_files & cleanup_paths
    orphaned = sorted(disk_files - local_refs - cleanup_paths)

    return {
        "database": str(database.resolve()),
        "uploadRoot": str(root),
        "storageScope": "local",
        "counts": {
            "databaseLocalReferences": len(local_refs),
            "missing": len(set(missing)),
            "orphaned": len(orphaned),
            "pathMismatches": len(path_mismatches),
            "pendingCleanupFiles": len(pending_cleanup_files),
            "skippedSymlinks": len(skipped_symlinks),
            "scanWarnings": len(scan_warnings),
            "s3ReferencesNotScanned": s3_references,
        },
        "missing": sorted(set(missing)),
        "orphaned": orphaned,
        "pathMismatches": path_mismatches,
        "pendingCleanupFiles": sorted(pending_cleanup_files),
        "cleanupQueueWarnings": cleanup_report,
        "skippedSymlinks": skipped_symlinks,
        "scanWarnings": scan_warnings,
        "notes": [
            "只读扫描；未修改数据库或文件。",
            "S3/MinIO 对象未扫描。",
            "孤儿文件只是未被当前数据库引用的本地文件，不代表可安全删除。",
        ],
    }


def print_text(report: dict[str, Any]) -> None:
    print("附件一致性只读盘点")
    print(f"数据库: {report['database']}")
    print(f"附件目录: {report['uploadRoot']}")
    for key, value in report["counts"].items():
        print(f"{key}: {value}")
    for heading, key in (
        ("未找到的本地附件", "missing"),
        ("未被数据库引用的文件（待人工复核）", "orphaned"),
        ("数据库路径异常", "pathMismatches"),
        ("清理队列中的文件", "pendingCleanupFiles"),
        ("跳过的符号链接", "skippedSymlinks"),
        ("扫描警告", "scanWarnings"),
    ):
        values = report[key]
        print(f"\n{heading}:")
        if not values:
            print("  无")
            continue
        for value in values:
            if isinstance(value, dict):
                print(f"  {value['path']} — {value.get('reason', value.get('status', ''))}")
            else:
                print(f"  {value}")
    for note in report["notes"]:
        print(f"提示: {note}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path, help="SQLite 数据库文件路径")
    parser.add_argument("--uploads", required=True, type=Path, help="本地附件目录")
    parser.add_argument("--json", action="store_true", help="输出机器可读 JSON")
    args = parser.parse_args()

    try:
        report = build_report(args.database, args.uploads)
    except (OSError, sqlite3.Error, ValueError, KeyError) as error:
        print(f"盘点失败：{error}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_text(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
