# 账号隔离设计

## 背景

系统核心数据包括家庭成员、就诊、诊断、用药和附件。只要有一个查询、更新或删除操作没有绑定当前账号，就可能出现跨账号读写问题。

## 目标

1. 保证账号之间的数据天然隔离。
2. 避免只在业务层做脆弱的前置校验。
3. 通过测试验证关键隔离边界。

## 核心原则

### 默认拒绝

后端默认所有接口受 `JwtAuthGuard` 保护，只有显式标记的公开路由才允许匿名访问。

### 隔离下沉到 Repository

账号隔离不只放在 Controller 或 Service 层，而是直接下沉到 Repository 的 Prisma 查询条件中，例如：

- `user: { accountId }`
- `visit: { user: { accountId } }`

这样可以让查询、更新、删除在持久化层直接受限。

### 使用原子更新 / 删除

更新和删除优先采用 `updateMany` / `deleteMany` 等模式，通过返回 `count` 判断是否命中目标，以减少“先检查、再写入”带来的 TOCTOU 风险。

## 验证方式

当前已通过后端 e2e 测试验证以下场景：

- 未登录访问受保护接口被拒绝。
- 一个账号无法读取另一个账号的成员数据。
- 一个账号无法基于别人的 `userId` 或 `visitId` 新增数据。
- 一个账号无法修改、删除另一个账号的就诊、诊断、用药和附件。

## 关联代码

- `apps/server/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/server/src/modules/user/user.repository.ts`
- `apps/server/src/modules/visit/visit.repository.ts`
- `apps/server/src/modules/record/record.repository.ts`
- `apps/server/src/modules/medication/medication.repository.ts`
- `apps/server/src/modules/file/file.repository.ts`
- `apps/server/src/account-isolation.spec.ts`

## 风险与后续方向

- 当前主要覆盖账号级隔离，尚未进入更细粒度角色授权。
- 如果后续引入导出、审计、批处理任务，需要继续维持账号边界的一致性。
- 若接入后台管理能力，需要额外定义管理端的越权边界与审计策略。
