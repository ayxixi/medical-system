# Plan Usage Guide

> **首选：查看仓库内的活计划 [`docs/PLAN.md`](docs/PLAN.md)。**
> 该文件由 Copilot 在每次推进任务后同步更新，是当前真实进度的唯一权威来源。
> 下面提到的 session-state 中的 `plan.md` 只是初始快照，**不会被自动更新**。

This project's current implementation plan was created in a Copilot session-state file, not inside the repository.

## Current paths

- **Living plan（推荐）**：`docs/PLAN.md`（仓库内，会被持续更新）
- Initial snapshot（只读）：`<本机 Copilot session-state 目录>/plan.md`（本地路径，不入库）
- Project root: 本仓库根目录

## Best way to continue the same work

If you want to continue with the same conversation state, use:

```text
/resume
```

This is the best option because it can restore:

- the original conversation context
- the current todo state
- the working history around the plan

## If you open a new CLI window or a new chat

Open the project directory first, then tell Copilot to read the existing plan file before continuing.

Use this prompt:

```text
请读取并遵循这个计划文件继续工作：
<本机 Copilot session-state 目录>/plan.md

项目根目录：
<本仓库根目录>

先总结当前状态，再继续下一步实现。
```

## If the new session cannot access the plan file

Add the session-state directory to the allowed paths first, then ask Copilot to read the plan:

```text
/add-dir
```

Then provide this directory:

```text
<本机 Copilot session-state 目录>
```

After that, reuse the prompt above.

## If you open the project in an IDE chat

Paste the same prompt into the IDE chat and ask it to:

1. Read `plan.md`
2. Summarize the current state
3. Rebuild the todo list if needed
4. Continue implementation

## Important note

There are two kinds of state:

- `plan.md`: the human-readable plan file
- session todos: the structured task state stored in the original session

Because of that:

- `/resume` is best when you want full continuity
- reading `plan.md` is best when you start in a fresh window

## Quick copy template

```text
请读取并遵循这个计划文件继续工作：
<本机 Copilot session-state 目录>/plan.md

项目根目录：
<本仓库根目录>

先总结当前状态，再继续下一步实现。
```
