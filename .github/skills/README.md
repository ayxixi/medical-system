# Workspace Skills

## 目的

本目录用于保存面向当前仓库的可复用 Copilot skills，重点服务于工程文档维护与同步。

## 当前技能

- `doc-router`：判断某项信息应该写入哪类文档
- `plan-sync`：同步和维护 `docs/PLAN.md`
- `architecture-sync`：同步和维护 `docs/ARCHITECTURE.md`
- `design-record`：沉淀专题设计文档与 ADR

## 使用建议

- 当需求是“判断文档落点”时，优先使用 `doc-router`
- 当需求是“更新当前进度与下一步”时，优先使用 `plan-sync`
- 当需求是“更新工程总览、模块图或代码导航”时，优先使用 `architecture-sync`
- 当需求是“记录设计取舍或正式架构决策”时，优先使用 `design-record`

## 目录约定

每个 skill 目录至少包含：

- `SKILL.md`
- `README.md`
- `references/`
- `assets/`

这样可以把 discovery、使用说明、方法细节和复用清单分开维护。
