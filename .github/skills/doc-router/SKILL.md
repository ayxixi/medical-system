---
name: doc-router
description: "Use when the user asks where a change should be documented, how to route documentation updates, which doc to update, documentation structure, README vs PLAN vs ARCHITECTURE vs ADR, 文档归类, 文档落点, doc routing."
argument-hint: "[变更主题或需要归档的问题]"
user-invocable: true
disable-model-invocation: false
---

# doc-router

## Purpose

用于判断某个信息、改动或问题应该沉淀到哪一类工程文档中，避免把计划、设计、实现记录、运行说明和协作说明混写。

## When to Use

- 当用户问“这件事应该写到哪里”时使用。
- 当用户要更新文档，但不确定应该改 `README`、`PLAN`、`ARCHITECTURE`、`design`、`implementation-records`、`runbooks` 或 `ADR` 时使用。
- 当需要给一次改动建立文档落点和同步范围时使用。

## Inputs

- 必填：本次变更主题、问题或需要归档的内容
- 可选：受影响的模块、是否已有相关文档、是否需要同时更新多个文档

## Procedure

1. 读取仓库当前文档入口与目标目录，例如 `README.md`、`docs/README-INDEX.md`、`docs/PLAN.md`、`docs/ARCHITECTURE.md`。
2. 判断输入属于哪一类信息：入口说明、活计划、架构总览、专题设计、实施记录、运行手册或正式决策。
3. 输出推荐的主文档落点；如果需要，同时给出次级联动文档。
4. 使用以下资源辅助判断：
   - [文档分流指南](./references/routing-guide.md)
   - [文档决策清单](./assets/decision-checklist.md)
5. 如果用户要求直接落地更新，再进入对应文档并执行修改。

## Output

- 明确指出应更新的主文档。
- 说明为什么应写入该文档，而不是其他文档。
- 如有必要，列出需要联动更新的次级文档。
- 提醒是否需要同步 `README`、`PLAN` 或 `ARCHITECTURE`。

## Notes

- 本 skill 负责“路由到正确文档”，不替代具体文档内容写作。
- 如果是长期固定规则，优先写入 instructions，而不是文档正文。
