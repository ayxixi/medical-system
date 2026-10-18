# doc-router

## 作用

`doc-router` 用于给工程变更做文档归类，帮助维护者快速判断某项内容应该写进哪一类文档。

## 适用场景

- 想判断某次改动应更新哪份文档
- 想避免 `README`、`PLAN`、`ARCHITECTURE`、`design`、`ADR` 混用
- 想为一次任务建立清晰的文档同步范围

## 目录结构

- `SKILL.md`：Skill 入口说明、输入输出与工作流程
- `references/routing-guide.md`：文档分流规则
- `assets/decision-checklist.md`：执行时可复用的判断清单

## 输出预期

运行该 skill 后，应能得到：

- 主文档落点
- 次级联动文档
- 简要原因说明
