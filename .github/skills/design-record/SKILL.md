---
name: design-record
description: "Use when the user asks to write or update a design document, record technical rationale, create an ADR, capture architecture decisions, design notes, tradeoffs, 设计文档沉淀, ADR 记录, 设计决策记录."
argument-hint: "[设计主题、决策主题或需要沉淀的问题]"
user-invocable: true
disable-model-invocation: false
---

# design-record

## Purpose

用于把一次重要的技术设计、专题方案或架构决策沉淀为可长期维护的文档，并标准化判断应该写入 `docs/design/` 还是 `docs/adr/`。

## When to Use

- 当用户要求补设计文档、设计说明、技术取舍说明时使用。
- 当用户要求新增或更新 ADR 时使用。
- 当某项改动涉及数据模型、权限边界、存储策略、跨模块约束，需要把“为什么这样做”沉淀下来时使用。

## Inputs

- 必填：设计主题、决策主题或待沉淀的问题
- 可选：影响模块、已有实现、已有文档、候选方案、验证结果

## Procedure

1. 先读取现有相关文档，例如 `docs/design/`、`docs/adr/README.md`、`docs/ARCHITECTURE.md`。
2. 先检查 `docs/design/` 与 `docs/adr/` 中是否已经存在主题相近的文档，判断本次更适合“更新已有文档”还是“新增文档”。
3. 判断本次内容属于哪一类：
   - 专题设计说明：写入 `docs/design/`
   - 正式长期决策：写入 `docs/adr/`
4. 根据仓库现有命名模式，自动推荐目标文件名：
   - `design` 文档：推荐英文 kebab-case 文件名
   - `ADR` 文档：只有在确认不是已有相近主题后，才推荐 `000X-topic.md` 形式的下一个可用编号
5. 使用以下资源辅助判断、命名和写作：
   - [设计与 ADR 分流指南](./references/design-vs-adr.md)
   - [相近主题去重指南](./references/duplicate-check-guide.md)
   - [命名推荐指南](./assets/naming-guide.md)
   - [设计文档模板](./assets/design-template.md)
   - [ADR 模板](./assets/adr-template.md)
   - [沉淀检查清单](./assets/record-checklist.md)
6. 从真实代码与真实约束出发，写清背景、目标、方案、取舍、影响与验证方式。
7. 如设计结论已影响系统全景、计划或入口文档，提醒联动 `ARCHITECTURE`、`PLAN` 或 `README`。
8. 更新完成后做最小校验，确保文档章节完整、落点正确、命名符合仓库约定，且与仓库现状一致。

## Output

- 明确本次内容应写入 `docs/design/` 还是 `docs/adr/`
- 明确应更新已有文档还是新增文档
- 给出推荐的 design 文件名或 ADR 编号文件名
- 说明新增或更新了哪份文档
- 说明沉淀了哪些背景、方案、取舍和影响
- 提醒是否需要联动其他工程文档

## Notes

- `design` 关注专题方案与设计推导。
- `ADR` 关注正式决策及其长期影响。
- 单次实现过程不应写进 ADR，通常应进入 `implementation-records`。
