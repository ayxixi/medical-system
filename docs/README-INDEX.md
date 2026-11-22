# 文档索引

## 目的

本文档用于说明仓库内各类文档的职责、阅读顺序与维护边界，避免计划、设计、实现记录和运行说明混杂在一起。

## 推荐阅读顺序

1. 先阅读 [README.md](../README.md)，了解项目简介、技术栈与启动方式。
2. 再阅读 [ARCHITECTURE.md](./ARCHITECTURE.md)，理解系统整体架构、模块边界与数据流。
3. 阅读 [PLAN.md](./PLAN.md)，查看当前实施进度与下一步计划。
4. 根据具体主题，进入 [design/](./design/) 查看专题设计文档。
5. 如需追溯某次实现过程，进入 [implementation-records/](./implementation-records/) 查看实施记录。
6. 如需执行开发、测试、发布或运维操作，进入 [runbooks/](./runbooks/) 查看运行手册。
7. 如需查看正式的架构决策，进入 [adr/](./adr/) 查看决策记录。

## 文档分类

### 入口类文档

- [README.md](../README.md)：项目入口，面向新成员与快速启动。
- [PLAN_USAGE.md](../PLAN_USAGE.md)：Copilot 会话续接说明，面向协作和上下文恢复。

### 计划类文档

- [PLAN.md](./PLAN.md)：仓库内活计划，记录当前状态、阶段目标、已完成事项与下一步候选。

### 架构类文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)：工程全景，描述系统组成、模块关系、数据模型与关键约束。

### 设计类文档

- [design/auth-and-account-model.md](./design/auth-and-account-model.md)：账号与家庭成员模型设计。
- [design/account-isolation.md](./design/account-isolation.md)：账号隔离策略与仓储层约束。
- [design/file-storage-and-replace-flow.md](./design/file-storage-and-replace-flow.md)：文件存储与附件替换流程。

### 实施记录类文档

- [implementation-records/README.md](./implementation-records/README.md)：实施记录目录说明。
- [session-implementation-record-2026-04-30.md](./session-implementation-record-2026-04-30.md)：当前已存在的会话实现记录。

### 运行手册类文档

- [runbooks/testing.md](./runbooks/testing.md)：测试执行与验证手册。

### 决策记录类文档

- [adr/README.md](./adr/README.md)：ADR 目录说明与记录约定。

### 工程自动化技能

- [AI 协作开发流程](../AGENTS.md)规定 Issue、六阶段产物、PR 和校验要求。

- [../.github/skills/README.md](../.github/skills/README.md)：仓库级 Copilot skills 总览。
- [../.github/skills/doc-router/README.md](../.github/skills/doc-router/README.md)：文档分流 skill。
- [../.github/skills/plan-sync/README.md](../.github/skills/plan-sync/README.md)：活计划同步 skill。
- [../.github/skills/architecture-sync/README.md](../.github/skills/architecture-sync/README.md)：架构文档同步 skill。
- [../.github/skills/design-record/README.md](../.github/skills/design-record/README.md)：设计文档与 ADR 沉淀 skill。

## 维护规则

1. 改启动方式、环境变量或使用说明时，优先更新 [README.md](../README.md)。
2. 改系统边界、模块关系、数据流或部署形态时，更新 [ARCHITECTURE.md](./ARCHITECTURE.md)。
3. 改实施状态或优先级时，更新 [PLAN.md](./PLAN.md)。
4. 做出关键设计取舍时，更新 [design/](./design/) 或 [adr/](./adr/)。
5. 完成一次较大实现后，补充 [implementation-records/](./implementation-records/) 中的记录。
6. 增加新的开发、测试、发布、排障流程时，更新 [runbooks/](./runbooks/)。
7. 需要重复执行文档同步工作流时，优先复用 [../.github/skills/README.md](../.github/skills/README.md) 中的 skills，而不是每次从零开始描述流程。
