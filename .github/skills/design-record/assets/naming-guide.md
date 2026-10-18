# 命名推荐指南

## design 文件名推荐

`docs/design/` 下的文件建议采用英文 kebab-case 主题名，不加日期、不加序号。

推荐格式：

- `topic-name.md`
- `domain-behavior.md`
- `feature-flow.md`

当前仓库已有命名模式示例：

- `auth-and-account-model.md`
- `account-isolation.md`
- `file-storage-and-replace-flow.md`

推荐生成规则：

1. 先提炼主题主语和行为，例如“账号隔离”“文件替换流程”“前端结构设计”
2. 转成简短英文关键词
3. 用 `-` 连接，避免空格、日期、中文和无意义前缀
4. 保持能从文件名直接猜到主题

### design 文件名示例

- 账号隔离增强：`account-isolation-enhancement.md`
- PostgreSQL 迁移设计：`postgresql-migration.md`
- 审计日志方案：`audit-log-design.md`
- 前端路由拆包：`frontend-route-splitting.md`

## ADR 编号推荐

`docs/adr/` 下的文件建议采用四位零填充编号加英文 kebab-case 标题。

推荐格式：

- `0001-topic.md`
- `0002-topic.md`

推荐生成规则：

1. 先检查 `docs/adr/` 和 `docs/design/` 中是否已有相近主题
2. 如果已有相近 ADR，优先更新原文件，不分配新编号
3. 如果确认是新的正式决策，再扫描 `docs/adr/` 下已有编号文件
4. 如果已存在编号，取最大编号 `+ 1`
5. 如果尚无编号文件，从 `0001` 开始
6. 标题部分使用英文 kebab-case，概括正式决策主题

### ADR 文件名示例

- `0001-account-user-split.md`
- `0002-repository-level-isolation.md`
- `0003-file-storage-abstraction.md`

## 简单判断法

- 如果重点是专题说明，优先生成 `docs/design/<topic>.md`
- 如果重点是正式决策，优先生成 `docs/adr/000X-<topic>.md`
- 但在生成新 ADR 之前，必须先判断是否已有相近主题文件可直接更新
