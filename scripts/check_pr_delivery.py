"""Find and validate the six-stage delivery in a GitHub pull request."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

SCRIPTS = Path(__file__).resolve().parent
DOCUMENTATION_FILES = {
    "AGENTS.md",
    "README.md",
    ".ai-workflow",
    ".github/ai-workflow-snapshot.sha256",
    ".github/pull_request_template.md",
    ".github/workflows/ai-delivery.yml",
    "scripts/check_delivery.py",
    "scripts/check_pr_delivery.py",
}
MARKER = re.compile(r"^[ \t]*<!--[ \t]*ai-delivery-directory:[ \t]*(.*?)[ \t]*-->[ \t]*$", re.MULTILINE)


def head_sha(pull, side):
    sha = pull[side]["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError(f"{side} SHA 无效")
    return sha


def other_submodules(project_root, commit):
    blob = f"{commit}:.gitmodules"
    exists = subprocess.run(
        ["git", "cat-file", "-e", blob], cwd=project_root, capture_output=True
    )
    if exists.returncode:
        return []
    entries = subprocess.check_output(
        ["git", "config", "--no-includes", f"--blob={blob}", "--null", "--list"],
        cwd=project_root,
    ).split(b"\0")
    return [entry for entry in entries if entry and not entry.startswith(b"submodule..ai-workflow.")]


def requires_delivery(project_root, pull):
    base, head = head_sha(pull, "base"), head_sha(pull, "head")
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", "-z", "--no-renames", f"{base}...{head}", "--"], cwd=project_root
    ).decode("utf-8", errors="replace").split("\0")
    for path in changed:
        if not path or path.startswith("docs/") or path in DOCUMENTATION_FILES:
            continue
        if path == ".gitmodules":
            ancestor = subprocess.check_output(
                ["git", "merge-base", base, head], cwd=project_root, text=True
            ).strip()
            if other_submodules(project_root, ancestor) == other_submodules(project_root, head):
                continue
        return True
    return False


def delivery_directory(project_root, body):
    matches = MARKER.findall(body or "")
    if len(matches) != 1:
        raise ValueError("实现 PR 需要一个 ai-delivery-directory 标记。请填写 PR 模板。")
    raw = matches[0]
    path = PurePosixPath(raw)
    if "\\" in raw or len(path.parts) < 2 or path.parts[0] != "docs" or ".." in path.parts:
        raise ValueError("产物目录必须是 docs 下的仓库相对路径。")
    directory = (project_root / path).resolve()
    if not directory.is_relative_to(project_root / "docs"):
        raise ValueError("产物目录必须位于仓库的 docs 内。")
    return directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    project_root = parser.parse_args().project_root.resolve()
    try:
        event_path = Path(os.environ["GITHUB_EVENT_PATH"])
        pull = json.loads(event_path.read_text(encoding="utf-8"))["pull_request"]
        if not requires_delivery(project_root, pull):
            print("文档或流程接入 PR。阶段检查完成。")
            return 0
        directory = delivery_directory(project_root, pull.get("body"))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"无法检查阶段产物：{error}", file=sys.stderr)
        return 1

    return subprocess.run(
        [sys.executable, str(SCRIPTS / "check_delivery.py"), str(directory)],
        cwd=project_root,
    ).returncode


if __name__ == "__main__":
    sys.exit(main())
