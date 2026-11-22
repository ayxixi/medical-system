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
| Docker 生产部署与备份/恢复 | 🟡 已实现，待端到端验证 | Compose、持久化卷、健康检查和脚本已合并；Docker 镜像构建未完成，容器启动与健康检查尚未验证（见 issue-14 验证记录） |
| 文件模块存储增强 | ✅ 已完成 | `DELETE /files/:id`、本地文件物理删除、`S3StorageService` 真实上传/删除实现 |
| 文件替换流程 | ✅ 已完成 | `PUT /files/:id`，附件行 “替换” 按钮，先写入新文件再删除旧文件避免数据丢失 |
| 就诊列表聚合与过滤/排序 | ✅ 已完成 | `GET /visits` 新增 `q`、`sortBy`、`order`；前端表头可点击排序（`date` / `createdAt`）与关键字搜索框 |
| 中文规范与文案统一 | ✅ 已完成 | instructions 固化、README 中文化、后端用户可见消息与校验提示中文化 |
| 附件清理与重试 | 已实现 | SQLite 事务登记删除和替换，后台清理并重试。S3 / MinIO 待联调 |
| 单元测试补齐 | 🟡 已开始 | service / repository 已覆盖 auth、user、visit、record、medication、file；另覆盖附件清理队列。存储服务、控制器和异常/边界分支仍可继续补齐 |
| Phase 3：Postgres + S3 | 🟡 已部分完成 | `S3StorageService` 已实现，仍需切换 datasource 并完成 Postgres / MinIO 实测 |
| Phase 4：审计日志 / 账号数据导出 | 🟡 部分完成 | 操作审计与按账号 JSON 导出已实现；仍需评估 ZIP 附件打包和导入恢复流程。Docker 数据卷备份/恢复已单独实现 |
| Phase 5：本机 OCR 与语音录入 | ⬜ 计划扩展 | RapidOCR 识别中文题图、faster-whisper 转写中文录音；识别结果先进入现有文本表单，人工修改并确认保存 |
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

## 三、下一步候选（按优先级）

1. **剩余单元测试**
   - 补充存储服务、控制器和未覆盖的异常/边界分支，重点维持账号过滤和对象存储失败恢复行为
2. **生产容器端到端验证**
   - 在 npm registry 可用的环境构建镜像，启动 Compose，检查迁移、健康检查、附件读写及备份恢复
3. **Phase 3：PostgreSQL + S3 验证**
   - docker-compose 启 Postgres，切换 `DATABASE_URL`
   - 设置 `FILE_STORAGE=s3`，配 MinIO 验证 `S3StorageService` 与附件清理重试
4. **Phase 4：审计日志 / 账号数据导出**
   - ✅ 新增 `AuditLog` 表与全局拦截器（仅业务写操作元数据）
   - ✅ 提供 `GET /export` 按账号导出 JSON 与附件元数据
   - 后续：可选附件原件打包导出、版本化数据导入/恢复和审计管理界面
5. **Phase 5：本机 OCR 与语音录入**
   - 先确定“本机”指部署系统的应用主机，还是每个网页用户自己的设备；Polaris 参考实现把媒体上传到自托管后端处理，并非浏览器本地推理
   - 确认文本落点：本系统目前没有“题干”字段；首选把草稿插入现有 `DiagnosisRecord.diagnosis` 或 `Visit.note` 编辑框，用户修改后仍通过原有保存动作提交，不自动建记录
   - OCR：拍照/选图、预览与重选；可选 `rapidocr-onnxruntime` 本地中文识别；返回文本与置信度；评估 HEIC 等格式是否需要额外依赖
   - 语音：浏览器录音、回放/重录；`faster-whisper` 本地中文转写（Polaris 参考配置为 `base`、CPU `int8`、语言 `zh`）；识别结果回填同一文本编辑框
   - NestJS 为认证与数据边界，评估用独立 Python worker/sidecar 承载识别依赖；不调用云端 OCR/ASR API
   - 模型首次下载/预置、可选安装包、CPU/内存、超时、上传大小和浏览器录音格式需在自托管与 Docker 部署中验证
   - 题图/录音默认作为临时输入处理并在识别完成后清理；仅在用户主动选择时保存为就诊附件。日志不记录原始识别文本
6. **历史孤儿附件盘点**
   - 在备份后对照数据库附件引用和本地/S3 对象，生成只读清单，再决定是否清理

### Phase 5 参考实现与边界

参考 [Polaris](https://github.com/ayxixi/Polaris) 的 `OCRCapture.vue`、`SpeechCapture.vue`、`MistakeNew.vue`，以及后端 `ocr.py`、`speech.py` 和可选 `recognition` 依赖组。其交互是拍照/选图或录音后识别，把文本追加到可编辑表单，最后由用户保存。

实施前需要完成以下设计确认：

- **计算位置**：若用户说的“本机”是运行本系统的自托管主机，可采用 Python sidecar；若指每个浏览器用户的电脑，则要考虑安装本地代理/桌面程序，不能把服务端推理称为“用户设备本地识别”。
- **目标字段**：本系统目前没有“题干/题目”实体，优先映射到诊断内容或就诊备注；若需求是独立题目记录，应另行设计数据模型和页面。
- **推理时限**：Polaris UI 限制录音约 60 秒，但其服务实现标注 10 秒超时；本项目不要照搬该时限，应以目标录音长度、CPU 性能实测设定可配置超时。
- **本地运行包**：RapidOCR 和 faster-whisper 属 Python 依赖，模型与原生运行库会增加安装体积和首次启动耗时；建议识别功能可选启用、支持预下载模型、缺少模型时明确提示并保留手动录入。
- **隐私与安全**：校验文件类型/内容/大小、认证和账号上下文；推理结果先作为草稿；临时媒体有清理策略，不把医疗文本写入日志，不连接第三方识别服务。
- **验收**：中文清晰/低质量题图、简短中文语音、空白/失败/超时、用户修改后保存、权限隔离、离线模型可用性、相机/麦克风权限、CPU/内存和临时文件清理都需验证。

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
