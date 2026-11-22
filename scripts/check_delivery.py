"""Check the shared six-stage delivery file and status convention."""

import argparse
from pathlib import Path
import re
import sys

RECORDS = (
    ("01-requirements.md", {"已记录"}),
    ("02-design-and-tasks.md", {"已记录"}),
    ("03-implementation.md", {"已记录"}),
    ("04-validation.md", {"已记录"}),
    ("05-review-and-merge.md", {"待评审", "评审中", "待合并", "已合并"}),
    ("06-release-and-retrospective.md", {"待发布", "已发布", "无需独立发布"}),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="directory containing the six deliverables")
    parser.add_argument("--stage", choices=("review", "merged", "released"), default="review")
    args = parser.parse_args()
    errors = []

    for filename, allowed in RECORDS:
        path = args.directory / filename
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            errors.append(f"{path}: {error}")
            continue

        statuses = re.findall(r"^状态[：:][ \t]*(\S[^\r\n]*)$", text, re.MULTILINE)
        if not re.search(r"^#[ \t]+\S", text, re.MULTILINE):
            errors.append(f"{path}: 缺少标题")
        if len(statuses) != 1 or statuses[0].strip() not in allowed:
            errors.append(f"{path}: 需要一行状态，允许值为 {'、'.join(sorted(allowed))}")
            continue
        status = statuses[0].strip()
        if filename == "05-review-and-merge.md" and args.stage != "review" and status != "已合并":
            errors.append(f"{path}: 结项时需要记录实际合并")
        if filename == "06-release-and-retrospective.md" and args.stage == "released" and status == "待发布":
            errors.append(f"{path}: 发布验收仍待完成")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"{args.directory}: 六份文件和阶段状态符合 {args.stage} 检查")
    return 0


if __name__ == "__main__":
    sys.exit(main())
