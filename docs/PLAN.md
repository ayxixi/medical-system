# 医疗记录系统 · 实施计划与进度

> 本文件是工程内的“活计划”（living plan），由 Copilot 在每次推进任务后同步更新。
> 历史会话快照位于本机 Copilot session-state 目录下的 `plan.md`，仅作参考，不再维护。

最近更新：2026-11-22

## 一、当前状态总览

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 后端骨架 / 配置 / Prisma | ✅ 已完成 | NestJS 10 + Prisma 6 + SQLite，env 校验，全局过滤器与日志拦截器 |
| 业务模块 MVP | ✅ 已完成 | user / visit / record / medication / file 全部 CRUD |
| 鉴权与账号隔离 | ✅ 已完成 | JWT + bcrypt，全局 `JwtAuthGuard` + `@Public`，仓储层全部带 `accountId` 过滤 |
| 跨账号隔离 e2e | ✅ 已完成 | `apps/server/src/account-isolation.spec.ts`，10/10 通过 |
| README 同步 | ✅ 已完成 | 含 PATCH/DELETE 接口与前端启动说明 |
| 前端脚手架 | ✅ 已完成 | Vite 6 + React 18 + AntD 5 + TanStack Query + zustand + axios |
| 登录 / 注册 / 路由守卫 | ✅ 已完成 | `/login`、`/register`、`RequireAuth` |
| 路由级懒加载 | ✅ 已完成 | 页面与 AppLayout 使用 `React.lazy`；入口 JS 从 1,343.76 KB 降至 470.02 KB（gzip 426.78 KB 降至 153.99 KB） |
| 业务页面 | ✅ 已完成 | 家庭成员、就诊列表（筛选+分页）、就诊详情（诊断/用药/附件 CRUD + 上传） |
| 文件模块存储增强 | ✅ 已完成 | `DELETE /files/:id`、本地文件物理删除、`S3StorageService` 真实上传/删除实现 |
| 文件替换流程 | ✅ 已完成 | `PUT /files/:id`，附件行 “替换” 按钮，先写入新文件再删除旧文件避免数据丢失 |
| 就诊列表聚合与过滤/排序 | ✅ 已完成 | `GET /visits` 新增 `q`、`sortBy`、`order`；前端表头可点击排序（`date` / `createdAt`）与关键字搜索框 |
| 中文规范与文案统一 | ✅ 已完成 | instructions 固化、README 中文化、后端用户可见消息与校验提示中文化 |
| 附件清理与重试 | 已实现 | SQLite 事务登记删除和替换，后台清理并重试。S3 / MinIO 待联调 |
| 单元测试补齐 | 🟡 已开始 | service / repository 已覆盖 auth、user、visit、record、medication、file；另覆盖附件清理队列。存储服务、控制器和异常/边界分支仍可继续补齐 |
| Phase 3：Postgres + S3 | 🟡 已部分完成 | `S3StorageService` 已实现，仍需切换 datasource 并完成 Postgres / MinIO 实测 |
| Phase 4：审计日志 / 备份导出 | ⬜ 待开始 | 操作审计、按账号导出数据 |

## 二、近期完成清单

- [x] Phase 0：骨架与环境
- [x] Phase 1：业务 MVP（user/visit/record/medication/file）
- [x] JWT 鉴权与账号隔离（仓储层 `where: { ..., user: { accountId } }`）
- [x] 跨账号隔离 e2e 测试（10 用例，覆盖列表/详情/更新/删除/上传）
- [x] README 同步到当前接口
- [x] Phase 1.5a：前端脚手架与登录/注册
- [x] Phase 1.5b：业务页面（成员、就诊、诊断、用药、附件）
- [x] Phase 1.1：文件替换流程（`PUT /files/:id` + 前端“替换”按钮）
- [x] Phase 1.1：就诊列表聚合与过滤 / 排序（`q` 关键字搜索 + `sortBy/order` 排序，前端联动）
- [x] 文件删除接口与 S3 存储真实实现（含 `.env.example` 与 README 同步）
- [x] 中文规范 instructions 与 README / 后端用户可见文本中文化
- [x] 单元测试补齐（已覆盖 `AuthService`、`VisitService`、`RecordService`、`MedicationService`、`FileService` 与 `AuthRepository`、`VisitRepository`、`RecordRepository`、`MedicationRepository`、`FileRepository`）
- [x] 家庭成员和附件清理关键路径测试（`UserService`、`UserRepository`、`AttachmentCleanupService`，覆盖账号过滤、最后成员保护、并发清理、引用保护与重试）
- [x] 路由级懒加载：登录、注册、首页、成员、就诊列表、详情和 AppLayout 按路由动态加载；初始入口 gzip 约减少 64%

## 三、下一步候选（按优先级）

1. **剩余单元测试**
   - 补充存储服务、控制器和未覆盖的异常/边界分支，重点维持账号过滤和对象存储失败恢复行为
2. **Phase 3：PostgreSQL + S3 验证**
   - docker-compose 启 Postgres，切换 `DATABASE_URL`
   - 设置 `STORAGE_DRIVER=s3`，配 MinIO 验证 `S3StorageService`
3. **Phase 4：审计日志 / 备份导出**
   - 新增 `AuditLog` 表与拦截器
   - 提供 `GET /export` 按账号导出 JSON

## 四、维护约定

- 每完成一个条目，同步把上方表格状态改为 ✅，并把"下一步候选"对应项移入"近期完成清单"。
- 大改动（新模块、字段变更、外部依赖）需要在这里追加一节"决策记录"，简述权衡。
- 同时维护 `README.md` 中的接口与启动说明，确保两者不漂移。

## 五、决策记录

- 2026-04-29：账号隔离统一走 Prisma 关系过滤（`user: { accountId }`），不在 service 层重复查询，避免 TOCTOU。
- 2026-04-29：删除/更新使用 `updateMany` / `deleteMany` 返回 `count` 判断是否命中，命中 0 抛 `NotFoundException`。
- 2026-04-30：前端选型 React + Vite + AntD + TanStack Query + zustand，目标长期维护与正规工程化。
- 2026-04-30：文件替换采用“先写入新文件 + 更新 DB 后再删除旧文件”的顺序，避免中间状态导致附件丢失；旧文件删除失败不阻断业务，仅产生孤儿文件（待后续清理作业）。

- 2026-11-22：通过 SQLite 触发器持久化附件清理任务，覆盖级联删除和替换。历史遗留孤儿文件需单独盘点。
- 2026-11-22：按路由使用 `React.lazy` 拆分页面。Vite 初始入口从 1,343.76 KB（gzip 426.78 KB）降至 470.02 KB（gzip 153.99 KB），首屏业务页面仅在进入相应路由后下载。
