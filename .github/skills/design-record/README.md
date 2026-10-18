# design-record

## 作用

`design-record` 用于把专题设计文档和 ADR 的沉淀流程标准化，帮助维护者判断应该写 `docs/design/` 还是 `docs/adr/`，并按统一结构记录背景、方案、取舍和影响。

## 适用场景

- 需要补一份新的专题设计文档
- 需要把关键技术取舍升级为 ADR
- 需要更新已有设计文档或 ADR
- 需要把“为什么这样做”沉淀为长期可维护文档

## 目录结构

- `SKILL.md`：Skill 入口说明、输入输出与步骤
- `references/design-vs-adr.md`：设计文档与 ADR 的分流规则
- `references/duplicate-check-guide.md`：相近主题去重规则
- `assets/naming-guide.md`：design 文件名与 ADR 编号推荐规则
- `assets/design-template.md`：专题设计文档模板
- `assets/adr-template.md`：ADR 模板
- `assets/record-checklist.md`：沉淀检查清单

## 输出预期

运行该 skill 后，应能得到：

- 正确的文档落点
- 是否应更新已有 design / ADR，而不是重复新建
- 推荐的 design 文件名或 ADR 编号文件名
- 结构化的设计或决策文档
- 对其他文档联动范围的提示
