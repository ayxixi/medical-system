# 医疗记录系统 · 本次会话实现记录

> 用途：保存本次 Copilot 会话的可共享工作记录，包括实现顺序、设计判断、关键代码落点、问题处理与验证结果。
>
> 说明：本文记录的是“可共享的设计过程与决策依据”，用于工程交接与追溯；不包含 Copilot 的逐字内部推理原文。

最近更新：2026-05-01

## 1. 会话目标与起点

本次会话从已有的 session-state 计划继续推进，核心目标有两类：

1. 把后端从“可跑通”推进到“可长期维护”，重点补齐账号隔离、接口完整性与测试验证。
2. 在计划原本偏后端的基础上，把前端正式补上，形成一个能登录、能管理成员、能管理就诊、能维护诊断/用药/附件的完整系统。

会话期间目标发生过一次扩展：

- 初始重点是后端延续开发。
- 中途用户明确提出需要长期维护、正规项目化的前端方案。
- 因此本次工作最终覆盖了：后端加强、前端搭建、业务页面实现、接口扩展、文档与计划维护。

### 1.1 会话环境与运行前提

本次会话对应的主要环境背景如下：

- 操作系统：Windows
- Node.js：21.7.1
- 后端基础栈：NestJS 10.4.8、Prisma 6.7.0、SQLite、JWT、bcryptjs
- 前端基础栈：React 18.3.1、Vite 6、Ant Design 5.22.5、TanStack Query 5.62.7、zustand 5、axios 1.7.9
- 前端补充依赖：`dayjs`，用于就诊日期展示、筛选与排序联动

额外说明：

- Node 版本虽然高于部分依赖常见示例环境，但本次会话中的构建、开发启动与测试流程均可正常完成。
- 前端开发代理使用 `/api -> http://localhost:3000`，因此本地联调时不需要额外单独配置 CORS。

## 2. 按计划与实装顺序编排的实施记录

为与 [docs/PLAN.md](docs/PLAN.md) 和 [README.md](README.md) 对齐，下文按计划阶段顺序编排；同一阶段内部再尽量按本次 session 的实际实现顺序展开。

### 2.1 读取旧计划并重建上下文

执行内容：

- 读取旧的 `plan.md` 与现有代码状态，重建本次会话的 todo。
- 确认需要先继续后端，再决定是否补前端。

产出：

- 明确了后端剩余风险集中在“账号隔离”和“接口补齐”。
- 后续又把工程内长期可维护的计划文件落到了 [docs/PLAN.md](docs/PLAN.md)。

### 2.2 鉴权与账号模型：引入 Account + JWT 体系

这一部分对应 PLAN 中的“鉴权与账号隔离”主线，也是 README 里认证接口能力的来源。

#### 背景判断

在最初的数据模型中，`User` 更像“家庭成员档案”，而不是“可登录账号”。如果直接在 `User` 上叠加邮箱和密码，会把“登录主体”和“被管理成员”混在一起。为了后续的家庭成员管理、账号隔离和权限边界更清晰，最终把两者拆开：

- `Account`：真正的登录账号，持有 `email` 与 `passwordHash`
- `User`：账号下面维护的家庭成员档案

#### 实现步骤

1. 在 Prisma schema 中新增 `Account` 模型，并为 `User` 增加 `accountId` 外键。
2. 新增 `20260429_add_account_auth` 迁移。
3. 创建 `auth` 模块，补齐：
   - `POST /auth/register`
   - `POST /auth/login`
   - `GET /auth/me`
4. 引入 `bcryptjs` 做密码哈希。
5. 引入 `@nestjs/jwt`、`@nestjs/passport`、`passport-jwt`，配置 `JwtStrategy`。
6. 在 `AppModule` 中注册全局 `JwtAuthGuard`，通过 `@Public()` 放行注册与登录接口。
7. 先把 `User` 模块按 `accountId` 收口，确保“我的家庭成员”不会直接跨账号暴露。
8. 为 `.env.example` 与本地 `.env` 增加 `JWT_SECRET`、`JWT_EXPIRES_IN`。

#### 关键代码落点

- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260429_add_account_auth/migration.sql`
- `apps/server/src/common/utils/string.util.ts`
- `apps/server/src/modules/auth/auth.module.ts`
- `apps/server/src/modules/auth/auth.controller.ts`
- `apps/server/src/modules/auth/auth.service.ts`
- `apps/server/src/modules/auth/auth.repository.ts`
- `apps/server/src/modules/auth/strategies/jwt.strategy.ts`
- `apps/server/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/server/src/modules/auth/decorators/public.decorator.ts`
- `apps/server/src/modules/auth/decorators/current-account.decorator.ts`
- `apps/server/src/modules/user/user.controller.ts`
- `apps/server/src/modules/user/user.service.ts`
- `apps/server/src/modules/user/user.repository.ts`

#### 设计取舍

- 全局 Guard 采用 fail-closed 策略：默认所有接口受保护，只有显式标记 `@Public()` 的路由才放行。
- 登录失败始终返回同一条错误消息，不区分“邮箱不存在”还是“密码错误”，避免用户枚举。
- 因为旧数据无法自动映射到新的 `accountId`，迁移中明确按开发库处理，允许清空旧样例数据后重建。

#### 遇到的问题与处理

- `login.dto.ts` / `register.dto.ts` 中对邮箱字段做 `toLowerCase()` 时，`trimString()` 的返回类型过宽，被 TypeScript 推断为 `unknown`。
  - 处理方式：为 `trimString` / `trimOptionalString` 补充重载签名，让“字符串进、字符串出”的类型关系对编译器可见。
- 加入 JWT 环境变量校验后，本地开发环境因为缺少 `JWT_SECRET` 而启动失败。
  - 处理方式：补齐 `apps/server/.env` 中的 `JWT_SECRET` 与 `JWT_EXPIRES_IN`，随后再次验证服务启动。

### 2.3 业务 CRUD 与账号隔离补强

这一部分对应 PLAN 中的“Phase 1：业务 MVP”与“鉴权与账号隔离”落地补强。

#### 背景判断

在检查 `visit / record / medication / file` 相关代码时，发现系统虽然已经有账号体系，但部分业务查询和写入仍存在“只按 id 命中”的风险。如果只按主键更新或删除，而不把 `accountId` 约束带进仓储层，理论上就可能出现跨账号读写。

#### 实现步骤

1. 从 controller -> service -> repository 链路逐个检查调用是否真正带上了账号上下文。
2. 把账号隔离的核心判断下沉到 Prisma 仓储层，而不是只放在 service 中做前置检查。
3. 对 `visit / record / medication / file / user` 等业务补齐缺失的更新与删除接口。
4. 为更新场景单独增加 `Update DTO`，避免直接复用创建 DTO，减少字段含义混乱。
5. 用户删除场景额外增加“账号下至少保留一个成员”的业务约束。

#### 关键代码落点

- `apps/server/src/modules/visit/visit.controller.ts`
- `apps/server/src/modules/visit/visit.service.ts`
- `apps/server/src/modules/visit/visit.repository.ts`
- `apps/server/src/modules/visit/dto/update-visit.dto.ts`
- `apps/server/src/modules/record/record.controller.ts`
- `apps/server/src/modules/record/record.service.ts`
- `apps/server/src/modules/record/record.repository.ts`
- `apps/server/src/modules/record/dto/update-record.dto.ts`
- `apps/server/src/modules/medication/medication.controller.ts`
- `apps/server/src/modules/medication/medication.service.ts`
- `apps/server/src/modules/medication/medication.repository.ts`
- `apps/server/src/modules/medication/dto/update-medication.dto.ts`
- `apps/server/src/modules/user/user.controller.ts`
- `apps/server/src/modules/user/user.service.ts`
- `apps/server/src/modules/user/user.repository.ts`
- `apps/server/src/modules/user/dto/update-user.dto.ts`
- `apps/server/src/modules/file/file.controller.ts`
- `apps/server/src/modules/file/file.service.ts`
- `apps/server/src/modules/file/file.repository.ts`

#### 设计取舍

- 账号隔离统一放在 repository 的 Prisma `where` 条件里，典型形式为 `user: { accountId }` 或 `visit: { user: { accountId } }`。
- 更新和删除优先使用 `updateMany` / `deleteMany`，通过返回的 `count` 判断是否命中。这样能把“是否属于当前账号”与“是否存在”压缩进一次原子操作，避免 TOCTOU（检查与实际写入间的时间差问题）。
- `Update DTO` 只允许更新真正可变的字段，不允许借由更新接口跨对象修改 `userId` / `visitId` 之类的关联主线。

### 2.4 跨账号隔离 e2e 验证

这一部分对应 PLAN 中的“跨账号隔离 e2e”。

#### 目标

仅靠代码审查不足以证明账号隔离真的完整，因此补了一套端到端测试，直接模拟两个账号相互隔离的真实行为。

#### 实现步骤

1. 新建账号隔离测试文件：`apps/server/src/account-isolation.spec.ts`。
2. 在测试中分别注册 Alice 与 Bob 两个账号。
3. 由 Alice 创建成员、就诊、诊断、用药、附件。
4. 用 Bob 的 token 去尝试读取、更新、删除 Alice 的数据，预期全部失败。
5. 在 `beforeAll` 阶段使用 `prisma db push --force-reset --skip-generate` 重置测试库，确保每次测试都从干净数据开始。

#### 遇到的问题与处理

- Jest 没有识别新的 e2e 文件，因为文件名模式与项目当前 `testRegex` 不匹配。
  - 处理方式：将测试文件名调整为 `.spec.ts` 形式。
- Prisma 重置数据库耗时超过 Jest 默认 5 秒。
  - 处理方式：在测试文件中增加 `jest.setTimeout(60000)`。

#### 验证结果

- 10 个跨账号测试全部通过。

### 2.5 README 同步到当前接口能力

这一部分对应 PLAN 中的“README 同步”。

实现内容：

- 把后端新增的 PATCH / DELETE 接口同步进 README。
- 当前端上线后，把前端启动方式、代理说明与受保护路由说明补进 README。
- 在文件替换、就诊列表排序增强、S3 真实实现完成后，README 再次同步新增接口行为与配置说明。

这一步的目标不是“装饰文档”，而是确保项目说明和真实接口不会漂移。

### 2.6 前端方案决策：选择长期维护的正规技术栈

这一部分对应 PLAN 中的“前端脚手架”和“登录 / 注册 / 路由守卫”的准备阶段。

用户明确要求“长期维护，并做成正规项目”，因此需要一个不是临时页面拼接、而是足够工程化的前端方案。

#### 最终选择

- React 18
- Vite 6
- Ant Design 5
- TanStack Query 5
- zustand 5
- axios
- React Router 6
- Vitest

#### 选择理由

- React + Vite：生态成熟、启动快、后续拆分路由和构建优化空间大。
- Ant Design：表单、表格、上传、弹窗等后台管理场景能力完整，适合医疗记录这类信息管理系统。
- TanStack Query：把服务端状态、缓存与失效逻辑标准化，减少手写请求状态管理。
- zustand：只负责本地会话状态（token、account），足够轻量，不必为了很少的全局状态引入更重的方案。

### 2.7 前端 Phase 1.5a：脚手架、认证、基础布局

这一部分对应 PLAN 中的“Phase 1.5a：前端脚手架与登录 / 注册页”。

#### 实现步骤

1. 在 `apps/web/` 下创建 Vite + React + TypeScript 项目结构。
2. 配置 `@/*` 路径别名与 Vite 代理：`/api -> http://localhost:3000`。
3. 创建统一 axios 客户端，负责 Bearer Token 注入与 401 清理登录态。
4. 用 zustand 持久化登录状态：`medical-system.auth`。
5. 创建路由守卫 `RequireAuth`。
6. 创建基础布局 `AppLayout`。
7. 实现登录页、注册页、首页占位页。

#### 关键代码落点

- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `apps/web/vitest.config.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/auth.ts`
- `apps/web/src/store/auth.ts`
- `apps/web/src/routes/RequireAuth.tsx`
- `apps/web/src/layouts/AppLayout.tsx`
- `apps/web/src/pages/auth/LoginPage.tsx`
- `apps/web/src/pages/auth/RegisterPage.tsx`
- `apps/web/src/pages/home/HomePage.tsx`

#### 遇到的问题与处理

- Vite 配置与 Vitest 配置混写时，出现插件类型不兼容。
  - 处理方式：将测试配置拆到独立的 `vitest.config.ts`，通过 `mergeConfig` 复用 Vite 基础配置。

### 2.8 前端 Phase 1.5b：业务页面（成员 / 就诊 / 诊断 / 用药 / 附件）

这一部分对应 PLAN 中的“Phase 1.5b：业务页面”。

#### 目标

把前端从“只有登录”推进到“可真正操作业务数据”。

#### 实现步骤

1. 先补齐前端 API 封装：`users / visits / records / medications / files`。
2. 实现成员管理页：列表、新增、编辑、删除。
3. 实现就诊列表页：成员筛选、日期筛选、新增就诊、详情入口、删除。
4. 实现就诊详情页：展示就诊信息，并在同一页维护诊断、用药、附件。
5. 把这些页面接入路由与左侧菜单。
6. 调整首页，改成统计与快捷入口，而不是纯占位内容。

#### 关键代码落点

- `apps/web/src/api/users.ts`
- `apps/web/src/api/visits.ts`
- `apps/web/src/api/records.ts`
- `apps/web/src/api/medications.ts`
- `apps/web/src/api/files.ts`
- `apps/web/src/pages/users/UsersPage.tsx`
- `apps/web/src/pages/visits/VisitsPage.tsx`
- `apps/web/src/pages/visits/VisitDetailPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/layouts/AppLayout.tsx`
- `apps/web/src/pages/home/HomePage.tsx`

#### 页面设计要点

- 成员管理使用表格 + 弹窗表单，适合中小规模家庭成员集合。
- 就诊详情把诊断、用药、附件聚合在一个页面，减少在多个页面之间来回跳转。
- 所有增删改操作统一通过 TanStack Query 的 `invalidateQueries` 刷新对应数据，而不是手工维护页面局部状态。
- 附件上传使用 Ant Design `Upload` 的 `customRequest`，避免受限于默认上传流程，便于统一走业务接口。

### 2.9 Phase 1.1：文件替换流程

这一部分对应 PLAN 中的“Phase 1.1：文件替换流程”，也与 README 里的 `PUT /files/:id` 对齐。

#### 目标

原有附件能力只有上传与删除，还不支持“保留同一条附件记录，只替换实际文件内容”。因此补齐文件替换流程。

#### 实现步骤

1. 后端在 `file.controller.ts` 增加 `PUT /files/:id`。
2. `file.service.ts` 增加 `replace(accountId, id, file)`，复用原有文件校验逻辑。
3. `file.repository.ts` 增加 `updateById()`。
4. 前端 `apps/web/src/api/files.ts` 新增 `replaceFile(id, file)`。
5. 就诊详情页附件列表每一行增加“替换”按钮，直接调起 `Upload`。

#### 设计取舍

- 替换过程采用“先保存新文件 -> 更新数据库 -> 再删除旧文件”的顺序。
- 这样做的原因是：如果先删旧文件再写新文件，而新文件保存失败，就会让原附件彻底丢失。
- 旧文件删除失败不会阻断主流程，只会产生孤儿文件，后续可以通过清理作业处理。

### 2.10 Phase 1.1：就诊列表聚合与过滤 / 排序增强

这一部分对应 PLAN 中原表述为“就诊详情聅合与过滤/排序”的条目；结合实际代码与 README，实际落地的是 **就诊列表** 查询增强。

#### 背景

原始 `GET /visits` 只支持 `userId / from / to`，对真实使用场景不够。用户查看历史就诊时，经常会按医院、医生、诊断、药名等关键词检索，也需要按时间排序。

#### 实现步骤

1. 后端 `ListVisitsQueryDto` 增加：
   - `q`
   - `sortBy=date|createdAt`
   - `order=asc|desc`
2. `visit.repository.ts` 中为 `q` 增加模糊匹配，覆盖：
   - `hospital`
   - `department`
   - `doctor`
   - `note`
   - 成员姓名
   - 诊断内容
   - 药品名称
3. `orderBy` 从固定排序改成可配置排序，并保留默认值 `date desc, createdAt desc`。
4. 前端 `VisitsPage.tsx` 增加关键字搜索框和服务端排序联动。
5. 表格新增“创建时间”排序列，切换排序时改为走服务端结果，而不是浏览器端临时排序。

#### 设计取舍

- 排序逻辑放在后端，而不是只靠前端表格排序，是为了让筛选、分页、排序来源一致，避免前端拿到一批数据后再做二次排序造成语义偏差。
- 关键字搜索优先覆盖最常见的检索维度，不额外引入全文检索系统，先以 Prisma 的关系过滤满足当前规模需求。

### 2.11 文件模块增强：删除接口与 S3 真实实现

这一部分与 PLAN 中“Phase 3：Postgres + S3 已部分完成”对齐，也与 README 当前的文件存储与 S3 说明保持一致。

#### 背景

在计划继续推进时，文件模块还存在两个明显缺口：

1. `DELETE /files/:id` 还没有正式落地，附件只能上传和查询。
2. S3 存储虽然预留了接口，但实现仍是 placeholder，无法真正切换到对象存储。

#### 实现步骤

1. 扩展 `storage.interface.ts`，为存储抽象增加 `delete(relativePath)`。
2. 在本地存储实现中增加物理文件删除逻辑。
3. 在 `file.repository.ts` 中补充 `findById` / `deleteById` / `updateById` 等能力。
4. 在 `file.service.ts` 中实现删除流程，并在后续扩展为“替换文件”能力的公共基础。
5. 在 `file.controller.ts` 中增加 `DELETE /files/:id`，并在后续继续扩展出 `PUT /files/:id`。
6. 把 `S3StorageService` 从抛错占位改为真实的 AWS SDK `PutObjectCommand` / `DeleteObjectCommand` 实现。
7. 为 `.env.example`、`package.json`、README 补充 S3 配置说明与依赖项。

#### 关键代码落点

- `apps/server/src/modules/file/storage/storage.interface.ts`
- `apps/server/src/modules/file/storage/local-storage.service.ts`
- `apps/server/src/modules/file/storage/s3-storage.service.ts`
- `apps/server/src/modules/file/file.repository.ts`
- `apps/server/src/modules/file/file.service.ts`
- `apps/server/src/modules/file/file.controller.ts`
- `apps/server/package.json`
- `apps/server/.env.example`
- [README.md](README.md)

#### 设计取舍

- 数据库存储的始终是 `relativePath`，而不是本机绝对路径。这样本地存储和 S3 可以共享同一套业务字段。
- 本地删除操作额外做“只能删除上传目录内部文件”的路径边界检查，避免路径逃逸。
- S3 删除同样拒绝包含不安全对象键的输入。
- S3 凭证设计为“如果没有显式 access key / secret，则允许 AWS SDK 走默认 credential chain”，这样既支持本地开发，也兼容云上部署。

### 2.12 中文统一：把文档、代码文案和前端文案规则固化进仓库

这一部分对应 PLAN 中“中文规范 instructions 与 README / 后端用户可见文本中文化”的已完成项。

#### 背景

随着 README、后端异常消息和未来前端页面逐渐增多，如果不把“中文优先”的要求工程化，后续很容易在不同文件里再次混入英文说明。于是这一步不只是“手动翻译”，而是把规范沉淀成仓库级 instructions。

#### 实现步骤

1. 在 `.github/instructions/` 下创建文档规则：
   - `documentation-chinese.instructions.md`
2. 创建后端用户可见文本规则：
   - `user-facing-chinese.instructions.md`
3. 为未来前端页面和组件新增文案规则：
   - `frontend-chinese.instructions.md`
4. 把 README 改写成中文部署说明。
5. 批量把后端异常消息、配置错误、文件校验提示统一成中文。
6. 新增 `validation.util.ts`，通过全局 `ValidationPipe` 把 `class-validator` 默认英文提示统一翻译成中文。
7. 为 `Joi` 环境变量校验增加中文错误翻译，让启动失败提示也保持中文一致性。

#### 关键代码落点

- `.github/instructions/documentation-chinese.instructions.md`
- `.github/instructions/user-facing-chinese.instructions.md`
- `.github/instructions/frontend-chinese.instructions.md`
- [README.md](README.md)
- `apps/server/src/common/utils/validation.util.ts`
- `apps/server/src/main.ts`
- `apps/server/src/config/env.validation.ts`
- `apps/server/src/common/filters/http-exception.filter.ts`
- `apps/server/src/modules/auth/auth.service.ts`
- `apps/server/src/modules/file/file.service.ts`
- `apps/server/src/modules/visit/visit.service.ts`
- `apps/server/src/modules/record/record.service.ts`
- `apps/server/src/modules/medication/medication.service.ts`
- `apps/server/src/modules/user/user.service.ts`

#### 设计取舍

- 中文统一的对象是“人可读内容”，不是机械地把所有英文全部替换掉。
- 因此像环境变量名、HTTP 方法、库名、命令、对象键、S3 配置项这类机器稳定字段仍然保留英文。
- 错误码、字段名、接口路径保持稳定，只把真正展示给开发者或用户的说明文字改成中文，兼顾可维护性与兼容性。

### 2.13 工程内活计划建设：不再依赖 session-state 快照

在推进过程中，用户发现最初的 session-state `plan.md` 并不会自动记录新进度。为解决“下次打开看不到这次做到哪”的问题，补了两项工程化措施：

1. 在仓库内新增 [docs/PLAN.md](docs/PLAN.md)，作为持续更新的活计划。
2. 修改 [PLAN_USAGE.md](PLAN_USAGE.md)，明确以后优先读取 `docs/PLAN.md`，而不是旧的 session-state 快照。

这一步本质上是在解决“进度只存在聊天上下文里，不存在代码仓库里”的问题。

### 2.14 会话恢复方式调整：从 session-state 迁移到仓库内文档

在会话后段，用户重点追问了“为什么旧的 `plan.md` 看不到最新状态”和“是否可以通过 `/resume` 恢复当前进度”。这一步最终形成了一个明确的工程结论：

- session-state 里的 `plan.md` 只是旧快照，不会自动记录后续实现。
- `/resume` 适用于原始 Copilot CLI 会话恢复，但并不是 VS Code Chat 中稳定可依赖的续接方式。
- 因此本次会话把“当前做到哪”的权威记录迁移到了仓库内：
  - [docs/PLAN.md](docs/PLAN.md)：维护当前状态与下一步计划
  - 本文档：维护实现顺序、设计过程与问题处理记录

这一步虽然不是功能代码，但对后续协作连续性非常关键，因此也属于本次 session 的重要输出。

### 2.15 收尾：把本次实现过程落成可共享的会话文档

在会话收尾阶段，额外补了一份仓库内的实现记录，也就是本文档本身。目标不是复制聊天记录，而是把本次工作的“操作顺序、代码落点、设计判断、问题与解决方式”整理成可以交接、回看和继续开发的文档。

这一部分特别强调：

- 记录的是可共享的设计过程摘要
- 不记录逐字内部推理原文
- 重点服务于工程交接、后续续写和问题追溯

## 3. 本次会话的主要设计判断

### 3.1 账号隔离要依赖数据层约束，而不是只靠 service 逻辑

如果只在 service 里“先查一次是否属于当前账号”，再单独执行更新/删除，理论上仍然存在实现分散与时序问题。因此最终把账号隔离统一下沉到 Prisma `where` 条件中，并通过 `count` 判断命中结果。

### 3.2 业务前端优先选择成熟后台组件方案，而不是自绘 UI

本项目当前目标是“长期维护、尽快形成正式业务系统”，不是品牌展示型页面。因此选择 Ant Design 这类成熟后台组件库，比从零设计表格、表单、上传与弹窗体系更稳妥。

### 3.3 文档与计划必须落在仓库里，不能只存在聊天上下文

这次会话中最明确的流程优化之一，就是把“当前做到哪”的信息从 session-state 转移到仓库内的 `docs/PLAN.md`。这样即使换聊天窗口、换 IDE、甚至换执行人，也能从代码仓库本身恢复上下文。

### 3.4 文件替换与删除这类 I/O 操作，要优先保证数据不丢失

只要涉及对象存储或本地文件系统，最重要的不是“绝对没有残留文件”，而是“业务记录不能先丢”。因此文件替换场景把旧文件删除放到最后，优先保护用户数据可读性。

### 3.5 语言统一要通过工程规则固化，而不是靠会话里临时提醒

如果只在聊天里口头要求“以后都用中文”，这条约束不会稳定落到后续会话和不同文件类型上。最终采用 `.github/instructions/*.instructions.md` 把中文规则固化到仓库内，使 README、后端用户可见文本和未来前端 UI 文案都能自动继承同一套规范。

## 4. 关键问题与解决记录

### 4.1 Vite / Vitest 类型冲突

- 现象：测试配置写入 Vite 配置后，出现插件类型不兼容。
- 处理：拆分 `vite.config.ts` 与 `vitest.config.ts`。

### 4.2 Jest 未识别新 e2e 文件

- 现象：新增的隔离测试文件没有被执行。
- 处理：将文件名调整为 `.spec.ts`，与现有配置匹配。

### 4.3 Jest `beforeAll` 超时

- 现象：Prisma 初始化测试库时间超过 5 秒。
- 处理：`jest.setTimeout(60000)`。

### 4.4 前端打包体积偏大

- 现象：`npm run build` 可通过，但 Vite 持续提示主 chunk 超过 500KB。
- 当前结论：暂不阻塞功能上线，后续进入“路由级 lazy import”优化。

### 4.5 DTO transform 的类型丢失

- 现象：认证 DTO 使用 `trimString(value)?.toLowerCase()` 时，TypeScript 认为返回值不是字符串。
- 处理：为 `trimString` / `trimOptionalString` 增加函数重载，保持“字符串输入仍然返回字符串”的类型信息。

### 4.6 `.env` 与 `.env.example` 漂移

- 现象：`.env.example` 已加入 JWT 配置，但本地真实 `.env` 缺少同名字段，导致应用启动直接失败。
- 处理：补齐 `.env` 并重新启动验证，同时在 README 中明确要求先复制模板文件再运行。

## 5. 验证结果

本次会话中执行过的主要验证如下：

- 后端 `npm run build`：通过。
- 跨账号隔离 e2e：10/10 通过。
- 前端 `npm run build`：通过。
- 文件替换功能接入后，前后端再次 build：通过。
- 就诊列表搜索与排序增强接入后，前后端再次 build：通过。
- 认证 DTO 类型问题修复后，相关文件编译检查通过。
- 中文化异常消息与全局校验翻译接入后，相关文件 `get_errors` 检查通过。
- 本地 `.env` 补齐 JWT 配置后，`npm run start:dev` 能成功启动，Nest 路由映射正常输出。

### 5.1 关键命令轨迹摘要

为了让后续接手者更容易还原“这次到底怎么做的”，这里补充本次会话中真正起到验证或推进作用的关键命令：

- 后端构建：`cd apps/server && npm run build`
- 前端构建：`cd apps/web && npm run build`
- 账号隔离测试前重置测试库：`npx prisma db push --force-reset --skip-generate`
- 前端日期依赖补充：`cd apps/web && npm install dayjs`
- 本地后端启动验证：`cd apps/server && npm run start:dev`

说明：

- 文档不追求逐条保存所有终端输出，而是保留那些真正影响实现结论的关键命令与结果。
- 对构建过程中的前端 chunk size warning 已单独在问题记录中保留。

已知未解决但不阻断当前功能的问题：

- 前端生产构建主包体积仍偏大，有 chunk size warning。

## 6. 交付结果摘要

截至本次会话结束，系统已经具备以下能力：

- 账号注册、登录、鉴权。
- 按账号隔离的成员、就诊、诊断、用药、附件管理。
- 跨账号访问保护，并有 e2e 验证。
- 前端完整业务页面与基础布局。
- 附件上传、查询、删除、替换能力。
- 可切换的本地 / S3 存储实现。
- 就诊列表关键字搜索与服务端排序。
- 工程内可持续更新的计划文件与使用说明。
- 中文化的 README、后端用户可见文本与前端文案规范。
- 后端异常消息、校验提示与环境变量报错中文化。

### 6.1 文件级变更范围补充

如果需要从文件层面快速追踪本次 session 的影响面，可以优先按下面几组查看：

- 认证与账号体系：`apps/server/prisma/schema.prisma`、`apps/server/prisma/migrations/20260429_add_account_auth/migration.sql`、`apps/server/src/modules/auth/**`、`apps/server/src/modules/user/**`
- 账号隔离与业务 CRUD：`apps/server/src/modules/visit/**`、`apps/server/src/modules/record/**`、`apps/server/src/modules/medication/**`、`apps/server/src/modules/file/**`
- 文件存储：`apps/server/src/modules/file/storage/**`
- 全局中文化与校验：`apps/server/src/common/utils/validation.util.ts`、`apps/server/src/common/utils/string.util.ts`、`apps/server/src/main.ts`、`apps/server/src/config/env.validation.ts`
- 前端骨架与认证：`apps/web/src/App.tsx`、`apps/web/src/api/client.ts`、`apps/web/src/routes/RequireAuth.tsx`、`apps/web/src/store/auth.ts`
- 前端业务页面：`apps/web/src/pages/users/UsersPage.tsx`、`apps/web/src/pages/visits/VisitsPage.tsx`、`apps/web/src/pages/visits/VisitDetailPage.tsx`、`apps/web/src/layouts/AppLayout.tsx`、`apps/web/src/pages/home/HomePage.tsx`
- 计划与说明文档：`docs/PLAN.md`、`PLAN_USAGE.md`、`README.md`、本文档

## 7. 仍未完成的后续项

会话结束时，剩余项为：

1. 服务层 / 仓储层单元测试补齐。
2. 路由级 `lazy import`，优化主包体积。
3. PostgreSQL 与 S3 验证。
4. 审计日志与备份 / 导出。

以上顺序与 [docs/PLAN.md](docs/PLAN.md) 当前“下一步候选”保持一致。

## 8. 建议的后续使用方式

如果后续需要继续本项目开发，推荐固定使用以下顺序恢复上下文：

1. 先读 [docs/PLAN.md](docs/PLAN.md)
2. 再读本文档，了解“这一步是怎么一步步做到现在的”
3. 然后继续实现下一个待办，并同步更新 `docs/PLAN.md`

这样可以避免再次依赖无法自动更新的 session-state 快照。