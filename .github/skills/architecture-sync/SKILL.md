---
name: architecture-sync
description: "Use when the user asks to update architecture docs, sync system overview into docs/ARCHITECTURE.md, refresh module map, update data flow, code navigation, architecture diagram, system structure, 工程架构同步, 架构图更新."
argument-hint: "[本次架构变化或需同步的模块]"
user-invocable: true
disable-model-invocation: false
---

# architecture-sync

## Purpose

用于同步和维护 `docs/ARCHITECTURE.md`，确保工程总览文档能持续反映真实代码结构、模块边界、数据流和关键约束。

## When to Use

- 当用户要求更新架构文档或架构图时使用。
- 当后端模块、前端页面结构、数据模型或存储方式发生变化时使用。
- 当需要把真实代码结构整理成工程级总览时使用。

## Inputs

- 必填：发生变化的模块、页面、数据流、存储方式或架构约束
- 可选：需要更新的图、需要补充的代码导航、关联测试或部署变化

## Procedure

1. 读取 `docs/ARCHITECTURE.md` 作为当前架构总览。
2. 读取相关代码入口，例如后端 `app.module.ts`、`main.ts`、模块目录、前端 `App.tsx`、`api/`、`store/` 等。
3. 对照真实代码更新系统边界、模块关系、数据模型、交互链路和关键文件索引。
4. 如需更新图，优先保持图与正文一一对应。
5. 使用以下资源辅助维护：
   - [架构同步指南](./references/architecture-update-guide.md)
   - [架构更新检查清单](./assets/architecture-checklist.md)
6. 更新后执行最小校验，确保文档中的路径、图和结构描述可对应到真实仓库。

## Output

- 说明 `docs/ARCHITECTURE.md` 更新了哪些部分。
- 说明本次同步涉及哪些真实模块或页面。
- 提醒是否需要联动 `README`、`PLAN`、`design` 或 `runbooks`。

## Notes

- `docs/ARCHITECTURE.md` 应保持“全工程总览”定位，不应退化成单次会话记录。
- 如果某项内容属于专题设计推导，应落到 `docs/design/`，而不是把所有分析都堆进架构文档。
