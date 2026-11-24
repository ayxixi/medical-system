#!/usr/bin/env python3
"""Verify checksums in a medical-system account export ZIP without extracting it."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path
from typing import Any


def is_safe_archive_path(value: str) -> bool:
    if not value or "\\" in value or value.startswith("/"):
        return False
    return all(part not in ("", ".", "..") for part in value.split("/"))


def load_manifest(archive: zipfile.ZipFile, infos: list[zipfile.ZipInfo]) -> dict[str, Any]:
    manifest_infos = [info for info in infos if info.filename == "manifest.json"]
    if len(manifest_infos) != 1 or manifest_infos[0].is_dir():
        raise ValueError("归档中必须且只能有一个 manifest.json 文件")
    try:
        manifest = json.loads(archive.read(manifest_infos[0]).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("manifest.json 不是有效的 UTF-8 JSON") from error
    if (
        not isinstance(manifest, dict)
        or isinstance(manifest.get("manifestVersion"), bool)
        or manifest.get("manifestVersion") != 1
    ):
        raise ValueError("不支持的 manifest 版本")
    if manifest.get("algorithm") != "sha256" or not isinstance(manifest.get("files"), list):
        raise ValueError("manifest 的算法或文件清单格式无效")
    return manifest


def verify(archive_path: Path) -> int:
    with zipfile.ZipFile(archive_path, "r") as archive:
        infos = archive.infolist()
        filenames = [info.filename for info in infos]
        if len(filenames) != len(set(filenames)):
            raise ValueError("ZIP 中存在重复路径")
        if not infos or infos[-1].filename != "manifest.json":
            raise ValueError("manifest.json 不是 ZIP 中的最后一项")
        if any(
            not is_safe_archive_path(info.filename[:-1] if info.is_dir() else info.filename)
            for info in infos
        ):
            raise ValueError("ZIP 中存在绝对路径、路径穿越或不安全路径")
        if any(stat.S_ISLNK(info.external_attr >> 16) for info in infos):
            raise ValueError("ZIP 中包含不支持的符号链接")

        manifest = load_manifest(archive, infos)
        expected: dict[str, dict[str, Any]] = {}
        for entry in manifest["files"]:
            if not isinstance(entry, dict):
                raise ValueError("manifest 中存在格式无效的文件条目")
            name = entry.get("path")
            size = entry.get("size")
            digest = entry.get("sha256")
            if not isinstance(name, str) or not is_safe_archive_path(name):
                raise ValueError("manifest 中存在不安全文件路径")
            if name == "manifest.json" or name in expected:
                raise ValueError("manifest 中存在重复或禁止的路径")
            if isinstance(size, bool) or not isinstance(size, int) or size < 0:
                raise ValueError("manifest 文件大小无效")
            if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise ValueError("manifest SHA-256 无效")
            expected[name] = entry

        actual = {info.filename for info in infos if not info.is_dir() and info.filename != "manifest.json"}
        if actual != set(expected):
            missing = sorted(set(expected) - actual)
            unlisted = sorted(actual - set(expected))
            raise ValueError(
                f"归档与清单条目不一致；清单缺失 {len(missing)} 项，存在未列入清单的 {len(unlisted)} 项"
            )

        info_by_name = {info.filename: info for info in infos if not info.is_dir()}
        for name, entry in expected.items():
            info = info_by_name[name]
            if info.file_size != entry["size"]:
                raise ValueError("归档文件大小与 manifest 不匹配")
            digest = hashlib.sha256()
            size = 0
            with archive.open(info, "r") as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
                    size += len(chunk)
            if size != entry["size"] or digest.hexdigest() != entry["sha256"]:
                raise ValueError("归档文件 SHA-256 与 manifest 不匹配")

    print(f"校验完成：{len(expected)} 个文件与 manifest 一致。")
    print("此校验用于发现文件损坏，不验证备份来源或 manifest 的真实性；未输出归档文件名。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="账号 ZIP 备份文件路径")
    args = parser.parse_args()
    try:
        return verify(args.archive)
    except (OSError, zipfile.BadZipFile, RuntimeError, ValueError, KeyError) as error:
        print(f"校验失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
