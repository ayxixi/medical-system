# 医疗记录系统 · 实施计划与进度

> 本文件是工程内的“活计划”（living plan），由 Copilot 在每次推进任务后同步更新。
> 历史会话快照位于本机 Copilot session-state 目录下的 `plan.md`，仅作参考，不再维护。

最近更新：2026-11-23

## 一、当前状态总览

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 后端骨架 / 配置 / Prisma | ✅ 已完成 | NestJS 10 + Prisma 6 + SQLite，env 校验，全局过滤器与日志拦截器 |
| 业务模块 MVP | ✅ 已完成 | user / visit / record / medication / file 全部 CRUD |
| 鉴权与账号隔离 | ✅ 已完成 | JWT + bcrypt，用户名登录并兼容旧账号邮箱登录；全局 `JwtAuthGuard` + `@Public`，仓储层全部带 `accountId` 过滤 |
| 跨账号隔离 e2e | ✅ 已完成 | `apps/server/src/account-isolation.spec.ts`，10/10 通过 |
| README 同步 | ✅ 已完成 | 含 PATCH/DELETE 接口与前端启动说明 |
| 前端脚手架 | ✅ 已完成 | Vite 6 + React 18 + AntD 5 + TanStack Query + zustand + axios |
| 登录 / 注册 / 路由守卫 | ✅ 已完成 | `/login`、`/register`、`RequireAuth` |
| 路由级懒加载 | ✅ 已完成 | 页面与 AppLayout 使用 `React.lazy`；入口 JS 从 1,343.76 KB 降至 470.02 KB（gzip 426.78 KB 降至 153.99 KB） |
| 业务页面 | ✅ 已完成 | 家庭成员、就诊列表（筛选+分页）、就诊详情（诊断/用药/附件 CRUD + 上传） |
| Docker 生产部署与备份/恢复 | 🟡 已实现，待端到端验证 | Compose、持久化卷、健康检查、备份/恢复脚本和部署手册已就绪；目标环境镜像构建、容器启动及健康检查仍需实测 |
| 文件模块存储增强 | ✅ 已完成 | `DELETE /files/:id`、本地文件物理删除、`S3StorageService` 真实上传/删除实现 |
| 文件替换流程 | ✅ 已完成 | `PUT /files/:id`，附件行 “替换” 按钮，先写入新文件再删除旧文件避免数据丢失 |
| 就诊列表聚合与过滤/排序 | ✅ 已完成 | `GET /visits` 新增 `q`、`sortBy`、`order`；前端表头可点击排序（`date` / `createdAt`）与关键字搜索框 |
| 中文规范与文案统一 | ✅ 已完成 | instructions 固化、README 中文化、后端用户可见消息与校验提示中文化 |
| 附件清理与重试 | 已实现 | SQLite 事务登记删除和替换，后台清理并重试。S3 / MinIO 待联调 |
| 单元测试补齐 | 🟡 进行中 | service / repository 已覆盖主要业务模块；PR #55 已合并存储、识别、审计/导出与公共错误边界测试。业务控制器及剩余异常/边界分支仍可继续补齐 |
| Phase 3：Postgres + S3 | 🟡 已部分完成 | `S3StorageService` 已实现，仍需切换 datasource 并完成 Postgres / MinIO 实测 |
| Phase 4：审计日志 / 账号数据导出 | 🟡 部分完成 | 操作审计与按账号 JSON 导出已实现；仍需评估 ZIP 附件打包和导入恢复流程。Docker 数据卷备份/恢复已单独实现 |
| Phase 5：本机 OCR 与语音录入 | 🟡 首版已合并，待目标环境验收 | 拍照/选图、语音转写、可编辑预览及追加/替换已实现；模型预热、低质量媒体与目标设备体验待验证 |
| 全站 UI/UX 与移动端适配 | ✅ 已完成 | Issue #58 / PR #59 已合并：统一视觉与导航，重排成员、就诊列表和就诊详情；目标手机实机验收仍需部署环境复核 |
| 浅色/深色主题切换 | 🟡 待评审 | Issue #60 / PR #61：全站主题切换并在浏览器本地记住偏好 |
| 西西记录：日常病程 | 🟡 待评审 | Issue #62 / PR #63：手机快捷记录体温、服药、症状，查看时间线与近 7 天体温趋势；PR 依赖主题 PR #61 |
| 历史孤儿附件盘点 | ⬜ 待处理 | 附件清理队列已覆盖后续删除/替换，尚未盘点旧数据遗留的孤儿文件 |

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
- [x] 生产容器部署、健康检查、持久化卷与备份/恢复脚本（镜像构建及容器健康检查待实测）
- [x] 存储服务、识别代理、审计/导出、校验/异常与日志边界测试（PR #55；26 个 suites、138 tests 通过）
- [x] 识别结果可编辑预览，明确选择追加/替换并预览1000字限制（PR #52）
- [x] 用户名登录，旧账号保留邮箱登录并可设置用户名（PR #52；用户确认邮箱登录正常）
- [x] 全站响应式 UI 改版（Issue #58 / PR #59；桌面侧栏/手机底部导航、成员卡片、就诊移动卡片、详情分区；实际手机设备验收待部署环境确认）

## 三、下一步候选（按优先级）

1. **剩余单元测试**
   - PR #55 已覆盖存储提供方、识别、审计/导出和通用边界；后续补业务控制器与剩余异常分支，重点维持账号过滤和对象存储失败恢复行为
2. **生产容器端到端验证**
   - 在目标主机按 [Docker 部署运行手册](runbooks/docker-deployment.md) 构建镜像、启动 Compose，检查迁移、健康检查、附件读写及备份恢复
3. **Phase 3：PostgreSQL + S3 验证**
   - docker-compose 启 Postgres，切换 `DATABASE_URL`
   - 设置 `FILE_STORAGE=s3`，配 MinIO 验证 `S3StorageService` 与附件清理重试
4. **Phase 4：审计日志 / 账号数据导出**
   - ✅ 新增 `AuditLog` 表与全局拦截器（仅业务写操作元数据）
   - ✅ 提供 `GET /export` 按账号导出 JSON 与附件元数据
   - 后续：可选附件原件打包导出、版本化数据导入/恢复和审计管理界面
5. **Phase 5：本机 OCR 与语音录入**
   - ✅ “本机”按自托管应用主机实现；识别草稿进入 `DiagnosisRecord.diagnosis` 或 `Visit.note`，手动确认后保存
   - ✅ 首版提供拍照/选图与浏览器录音控件，通过 NestJS JWT API 调用内网可选 Python worker；不调用云端 OCR/ASR API
   - ✅ 上传限制默认 10 MB、录音最长 60 秒、代理超时可配置；worker 校验图像像素、音频格式/时长，转写临时文件处理后清理
   - ✅ Compose 增加可选 recognition profile、专用 bridge 网络、仅绑定到宿主机 loopback 的端口和独立模型卷；默认不拉起识别服务，普通手动录入不受影响
   - ✅ 本地 `start.py` 默认创建 Python 虚拟环境、安装识别依赖、准备模型并启动 worker；开发环境不需要 Docker，可用 `--no-recognition` 跳过
   - 后续需在目标部署环境验证 CPU/内存、离线可用性、低质量媒体、超时与麦克风/相机权限
- 后续计划：增加本机病历摘要；目前仅纳入计划，尚未实现。
6. **历史孤儿附件盘点**
   - 在备份后对照数据库附件引用和本地/S3 对象，生成只读清单，再决定是否清理

### Phase 5 设计决策及待验证边界

参考 [Polaris](https://github.com/ayxixi/Polaris) 的 `OCRCapture.vue`、`SpeechCapture.vue`、`MistakeNew.vue`，以及后端 `ocr.py`、`speech.py` 和可选 `recognition` 依赖组。其交互是拍照/选图或录音后识别，把文本追加到可编辑表单，最后由用户保存。

- **计算位置**：首版已确定为自托管应用主机；Nest 只接受认证请求并把媒体转发到自托管 worker，不调用云端识别 API。模型首次下载需访问模型源，下载完成后的推理不依赖云端服务。
- **目标字段**：首版映射到现有诊断内容和就诊备注；系统仍无独立题目实体，后续如需题库需另立需求。
- **推理时限**：浏览器录音最多 60 秒，上传最大 10 MB，Nest 默认等待最多 180 秒（可配置）。目标硬件的 CPU/内存和端到端响应时间待实测。
- **本地运行包**：识别依赖通过可选 Compose profile 安装，模型缓存单独持久化并提供预下载脚本；首次安装体积、模型源访问和完全离线部署待实测。
- **隐私与安全**：校验媒体类型/大小/像素/音频时长，JWT 和共享 API key 双重保护，worker 仅绑定宿主机 loopback 且无公网端口映射，音频临时文件在完成或失败后删除，日志不记录医疗正文。
- **验收**：首版与自动化测试已合并；清晰/低质量题图、真实中文语音、设备性能、失败/超时、相机/麦克风权限及手机浏览器行为仍需在目标环境联调。

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
- 2026-11-22：题图 OCR 与语音转写作为 Phase 5 规划扩展；优先采用自托管 Python worker，不调用第三方识别 API，但先确认“本机”所指的计算设备和医疗文本落点。
- 2026-11-22：Phase 5 本机开发默认通过 Python 虚拟环境运行识别 worker，生产部署仍可选择 Compose；worker 仅绑定 loopback，要求共享随机 API key，模型数据单独持久化，不把用户媒体和识别文本写入数据库或日志。
- 2026-11-22：PR #52 合并识别结果预览与用户名登录。摘要功能明确延期，后续另行立项。
- 2026-11-23：Issue #58 全站 UI/UX 改版完成开发；保留现有 API 与业务流程，手机真实设备验收列为发布前复核项。
