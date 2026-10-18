---
name: plan-sync
description: "Use when the user asks to update the living plan, sync progress into docs/PLAN.md, refresh current status, move completed work into the plan, maintain implementation plan, update next steps, plan synchronization, 活计划同步."
argument-hint: "[本次完成内容或计划变更]"
user-invocable: true
disable-model-invocation: false
---

# plan-sync

## Purpose

用于将当前实现进展同步到仓库内的活计划 `docs/PLAN.md`，保证计划文件持续反映真实状态，而不是停留在旧会话快照上。

## When to Use

- 当用户要求“更新计划”或“同步当前进度”时使用。
- 当一次功能实现、重构、测试补齐或阶段推进完成后使用。
- 当需要调整下一步优先级或把待办从“进行中”改为“已完成”时使用。

## Inputs

- 必填：本次已完成事项、当前进行中的事项，或需要调整的下一步候选
- 可选：关联模块、验证结果、风险与阻塞

## Procedure

1. 读取 `docs/PLAN.md` 作为当前权威活计划。
2. 对照代码、测试结果或用户说明，判断哪些事项已完成、进行中或待开始。
3. 更新状态总览、近期完成清单和下一步候选。
4. 如涉及关键决策变化，补充计划中的“决策记录”或提示联动 `design` / `ADR`。
5. 使用以下资源辅助更新：
   - [计划同步指南](./references/plan-update-guide.md)
   - [计划更新检查清单](./assets/plan-checklist.md)
6. 更新后执行最小校验，确保计划描述与当前代码状态不明显漂移。

## Output

- 说明 `docs/PLAN.md` 中更新了哪些状态。
- 指出哪些事项从待办移动到了完成。
- 说明新的下一步候选。
- 提醒是否还需要联动 `README`、`ARCHITECTURE` 或设计文档。

## Notes

- `docs/PLAN.md` 是仓库内唯一的活计划权威来源。
- session-state 中的 `plan.md` 只作为历史快照，不应作为持续更新目标。
