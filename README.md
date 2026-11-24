# 医疗记录系统

这是一个全栈医疗记录系统：后端基于 NestJS（位于 `apps/server/`），前端基于 React + Vite + Ant Design（位于 `apps/web/`）。支持本机开发和 Docker Compose 单机部署；当前数据库为 SQLite，附件支持本机目录和 S3 兼容对象存储。PostgreSQL 尚未验证。

## 当前功能范围

- 账号注册与登录（JWT）
- 家庭成员档案管理
- 西西记录：按成员快速记录体温、实际服药、症状和日常情况，查看 7 日体温趋势
- 西西记录提醒：按成员设置体温、服药和自定义提醒（应用打开时提示）
- 就诊记录管理
- 诊断记录管理
- 用药信息管理
- 文件上传、替换、查询与删除
- 可选自托管中文题图 OCR 与语音转写；结果回填诊断/备注草稿，用户确认后保存
- 本机/局域网 AI 问诊与病历摘要，发送前预览医疗文字，结果可编辑且不自动保存
- 已认证业务写操作审计（不记录请求正文或附件内容）
- 当前账号操作记录查询（元数据分页，不包含病历正文或附件内容）
- 当前账号医疗记录 JSON 导出与完整 ZIP 备份（包含附件原件）
- 前端登录 / 注册、受保护路由与业务页面（成员、就诊、诊断、用药、附件）
- 手机优先的病程时间线与快捷记录

## 技术栈

- Node.js 18+
- 后端：NestJS + Prisma ORM + SQLite
- 前端：React 18 + Vite + TypeScript + Ant Design 5 + TanStack Query + zustand
- Docker

## 文档导航

- 工程文档总索引：`docs/README-INDEX.md`
- 当前实施计划：`docs/PLAN.md`
- 工程架构总览：`docs/ARCHITECTURE.md`
- 专题设计文档：`docs/design/`
- 实施记录：`docs/implementation-records/`
- 测试运行手册：`docs/runbooks/testing.md`
- Docker 部署运行手册：`docs/runbooks/docker-deployment.md`
- Copilot 会话续接说明：`PLAN_USAGE.md`

## 项目结构

```text
medical-system/
  apps/
    server/
      prisma/
      src/
      uploads/
    web/
      src/
      vite.config.ts
  docs/
    PLAN.md
    ARCHITECTURE.md
    design/
    implementation-records/
    runbooks/
  docker/
    Dockerfile
  docker-compose.yml
```

## 一键启动本地开发环境

安装 Python 3.11/3.12、Node.js LTS 和 npm 后，在仓库根目录执行（首次运行需要联网安装依赖和模型）：

```bash
python start.py
```

如果本机命令是 `python3` 或 Windows 的 `py`，可换用对应命令。启动脚本会在 `apps/recognition/.venv` 创建隔离的 Python 环境并安装识别依赖；OCR/Whisper 模型保存在 `apps/recognition/models`，重复运行会复用。首次依赖和模型下载需要访问 Python 包索引及模型站点；网络中断后重新运行脚本即可重试。脚本自动生成本地 JWT 和识别 worker 密钥，密钥保存在 `apps/server/.env`，并启动只绑定本机地址的识别服务。脚本还会初始化独立的 `apps/server/prisma/local-dev.db`，附件保存在 `apps/server/uploads/local-dev/`。开发环境默认启用 OCR/语音，不需要 Docker；如暂时不需要识别，可用 `python start.py --no-recognition`。

启动后打开 `http://127.0.0.1:5173/`，首次使用可在页面注册。
后端使用本机 3000 端口，按 Ctrl+C 停止前后端及本次启动的识别服务；本地识别环境、配置和模型缓存会保留。启动脚本同一项目同时只允许运行一个实例，并会在服务启动前检查 3000、5173、8001 端口；若端口被其它程序占用，脚本会提示检查进程，不会自动结束其他程序。重复运行会继续使用同一份开发数据。

一键脚本每次启动时构建 Nest，后端代码修改后需重启脚本，单独运行后端仍可用 `npm run start:dev` 热重载。如果 3000 已被占用，可运行 `python start.py --backend-port 3001`，浏览器仍访问 5173。

在 Windows 上，关闭启动终端或强制结束启动器后，系统会自动结束由该启动器创建的服务进程并释放它们的监听端口。

### 手机通过局域网访问

运行 `python start.py --lan`。手机和电脑连接同一局域网，在手机浏览器打开 Vite 输出的 `Network` 地址，例如 `http://192.168.1.20:5173/`。如有多个地址，在 Windows 用 `ipconfig` 确认电脑当前使用的网卡 IPv4。若防火墙提示，允许 Node.js 在专用网络接收连接。

仅在可信局域网使用此模式。HTTP 下可以访问页面和选图识别，手机浏览器直接录音通常需要受信任的 HTTPS。

## 前端启动

前端工程位于 `apps/web/`。首次启动：

```bash
cd apps/web
npm install
npm run dev
```

开发地址默认为 `http://localhost:5173`。Vite 已配置代理：前端的 `/api/*` 请求会被转发到 `http://localhost:3000`，因此本地开发只需保证后端在 3000 端口运行即可，无需额外的 CORS 配置。

前端容器镜像在构建时使用同域 `/api` 地址，Nginx 会把 API 请求代理给 NestJS。Docker 部署无需单独设置前端 API 地址。

## 前端发布与使用

### 前端生产构建

在 `apps/web/` 下执行：

```bash
cd apps/web
npm install
npm run build
```

构建产物会输出到：

```text
apps/web/dist
```

如果需要先在本地用生产模式预览，可执行：

```bash
npm run preview
```

默认预览地址通常为 `http://localhost:4173`。

### 前端使用流程

前后端都启动后，推荐按下面顺序验证页面功能：

1. 打开前端地址，首次进入先注册账号，设置用户名、邮箱与密码
2. 登录后进入首页，检查账号信息与统计卡片是否正常显示
3. 进入“家庭成员”页面，新增至少一个成员
4. 进入“就诊记录”页面，新增就诊
5. 在就诊详情页继续新增诊断、用药，并上传或替换附件
6. 进入“西西记录”，用快捷入口记录体温、服药或症状；记录时间默认为当前时间

当前前端已提供以下页面：

- `/login`：登录页
- `/register`：注册页
- `/`：首页
- `/users`：家庭成员管理
- `/visits`：就诊列表
- `/visits/:id`：就诊详情
- `/health-logs`：西西记录（日常病程时间线）
- `/visit-summary`：按成员和日期范围整理、打印及导出就诊资料

## 已实现接口

除 `POST /auth/register` 和 `POST /auth/login` 外，其余接口都需要携带：

```text
Authorization: Bearer <accessToken>
```

### 认证接口

- `POST /auth/register`：注册账号（用户名 + 邮箱 + 密码），并同时创建第一个家庭成员
- `POST /auth/login`：使用用户名登录并获取 JWT；升级前创建的账号可暂时使用邮箱
- `PUT /auth/username`：为尚未设置用户名的旧账号设置用户名
- `GET /auth/me`：获取当前账号信息
- `POST /auth/change-password`：验证旧密码后修改密码，并撤销所有旧会话
- `GET /export`：导出当前账号 JSON 数据（版本化；不包含密码哈希和附件原件）
- `GET /export/archive`：流式导出当前账号 ZIP，包含 JSON 数据、附件原件和 SHA-256 完整性清单

### 用户接口

- `POST /users`：为当前账号新增家庭成员
- `GET /users`：查询当前账号下的家庭成员列表
- `GET /users/:id`
- `PATCH /users/:id`：修改成员姓名
- `DELETE /users/:id`：删除成员（账号下至少保留一个用户）

### 日常病程接口

- `POST /health-logs`：记录体温、服药、症状或日常情况
- `GET /health-logs?userId=...&from=...&to=...`：按家庭成员和时间范围查询
- `PATCH /health-logs/:id`：编辑记录
- `DELETE /health-logs/:id`：删除记录

病程记录独立关联到家庭成员，不改变就诊/处方数据；删除家庭成员时其病程记录级联删除。体温限制为 25–45°C，药物用量为用户手动填写文本，系统不提供诊断或剂量建议。

### 病程提醒接口

- `GET /health-reminders?userId=...`：按成员查询提醒
- `POST /health-reminders`：创建单次或每日重复提醒
- `PATCH /health-reminders/:id`：编辑提醒或暂停/恢复
- `DELETE /health-reminders/:id`：删除提醒
- `POST /health-reminders/:id/action`：标记完成或稍后提醒

提醒在用户打开“西西记录”页面时每分钟检查并显示；离开该页面或关闭浏览器期间不会保证系统级后台通知。提醒时间与说明由用户填写，系统不推算服药剂量或频率。

### AI 病历摘要接口

- `POST /ai/models/:id/summarize`：将用户确认的病程和就诊文字发送到已启用的本机/局域网模型，返回临时摘要；不保存请求或生成历史。

前端会在发送前展示模型地址和完整文本，且不发送附件。AI 结果只作为页面草稿，用户需核对后手动应用；不会自动写入病历数据库。

### 就诊接口

- `POST /visits`
- `GET /visits` 支持 query 参数：`userId`、`from`、`to`、`q`（在医院/科室/医生/备注/成员姓名/诊断/用药中模糊匹配）、`sortBy=date|createdAt`、`order=asc|desc`（默认 `date desc`）
- `GET /visits/:id`
- `PATCH /visits/:id`
- `DELETE /visits/:id`

### 诊断记录接口

- `POST /records`
- `GET /visits/:visitId/records`
- `PATCH /records/:id`
- `DELETE /records/:id`

### 用药接口

- `POST /medications`
- `GET /visits/:visitId/medications`
- `PATCH /medications/:id`
- `DELETE /medications/:id`

### 文件接口

- `POST /files/upload`
- `GET /visits/:visitId/files`
- `GET /files/:id/content`：下载当前账号所属的附件原件
- `PUT /files/:id` 以新文件替换现有附件（先写入新文件并更新 DB，再删除旧文件）
- `DELETE /files/:id`：删除附件记录，并登记物理文件清理

### 本机识别接口（可选）

- `POST /recognition/ocr`：上传 JPEG/PNG/WebP，识别中文文字
- `POST /recognition/transcribe`：上传 WebM/Ogg/WAV/MP3/M4A 等录音，中文转写

两个接口要求 JWT 登录；媒体上限默认 10 MB，录音时长上限 60 秒。NestJS 将媒体转发到管理员配置的自托管 Python worker，RapidOCR 与 faster-whisper 在应用主机处理。worker 不对公网开放，Compose 中仅绑定宿主机 loopback；识别结果只填入可编辑的诊断/就诊备注表单，不会自动保存。临时录音处理后删除；系统不记录媒体或识别正文。若 worker 未启用，业务页面和手动录入仍可用。

Docker Compose 默认不启动识别依赖。部署识别 worker、下载模型和关闭识别的方法见 [Docker 部署运行手册](docs/runbooks/docker-deployment.md#可选启用本机识别)。worker 仅加入应用专用 bridge，宿主机端口绑定到 `127.0.0.1`，不接受局域网或公网直连。开发环境无需 Docker，直接运行仓库根目录的 `python start.py` 即可安装本地依赖并启动 worker。

### 数据导出

`GET /export` 返回 `{ schemaVersion, exportedAt, account, users }`。成员下包含就诊、诊断、就诊用药、日常病程记录、病程提醒和附件元数据。导出受当前账号权限约束；附件仅包含原始文件名、MIME 类型、大小及记录时间，不包含文件内容、存储文件名或内部路径。响应不包含密码哈希和令牌信息。

登录后可从账号菜单选择“导出我的数据”，下载包含 `data.json`、说明文件、附件原件和 `manifest.json` 的 ZIP。清单记录其它归档文件的路径、大小与 SHA-256。附件按成员和就诊记录归档；服务端边读边打包并计算摘要，避免将所有附件一次性载入内存。导出中的记录与附件仅限当前账号，缺失或无法读取的附件会使导出失败并提示重试。下载后可在仓库目录运行 `python scripts/verify_export_manifest.py <备份ZIP路径>`，无需解压即可核对清单、文件数量、大小及摘要。该校验可发现文件损坏，但不验证备份来源或清单真实性。备份包含健康信息，请妥善保管。

本地 SQLite 环境可用 `scripts/restore_account_backup.py` 从带清单的账号 ZIP 预览并追加恢复到现有账号。该工具默认只预览，显式加入 `--apply` 并键入确认词后才会写入；原有资料不覆盖、不删除。恢复前须停止应用并备份数据库与附件。Docker 整库恢复仍使用 [部署恢复手册](docs/runbooks/docker-deployment.md#7-备份与恢复)；账号 ZIP 追加恢复的详细步骤见 [账号备份恢复手册](docs/runbooks/account-backup-restore.md)。

### 操作审计

`GET /audit?limit=20&cursor=<opaque>` 返回当前登录账号的操作记录，按时间倒序稳定游标分页；`limit` 范围为 1–100，默认 20。返回字段仅包括操作、资源类型/ID、HTTP 方法、状态与时间，不返回账号邮箱、请求正文或文件路径。

记录由已认证业务写操作生成，AI 对话、登录/注册等操作不一定在当前审计拦截范围内。

已认证的 `POST`、`PATCH`、`PUT`、`DELETE` 请求会记录账号、操作/资源类型、资源 ID、HTTP 方法、状态码、成功标记及时间。审计不保存请求正文、查询字符串、病历内容、密码、令牌或附件内容；审计写入失败不会改变业务请求结果。

### 生产认证配置

生产环境默认使用邀请码注册。配置 `REGISTRATION_MODE=invite` 与服务器环境变量
`REGISTRATION_INVITE_CODES`，多个邀请码用逗号分隔。开发环境默认开放注册。
登录默认在 15 分钟内失败 10 次后锁定来源地址 15 分钟，可通过
`LOGIN_MAX_ATTEMPTS`、`LOGIN_WINDOW_SECONDS` 和 `LOGIN_LOCKOUT_SECONDS` 调整。
若部署在可信反向代理后，可设置 `TRUST_PROXY=true`，使限流按客户端 IP 生效。
密码修改后，所有已签发的访问令牌立即失效。

## 环境变量

服务默认读取 `apps/server/.env`。

推荐先复制模板文件：

```bash
cd apps/server
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

基础配置示例：

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="file:./dev.db"
FILE_STORAGE=local
UPLOAD_PATH=./uploads
MAX_FILE_SIZE_MB=10
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1d
```

由于 Prisma schema 位于 `apps/server/prisma`，SQLite 数据库文件最终会出现在 `apps/server/prisma/dev.db`。

## 部署说明

### 部署前准备

- 本机开发：安装 Node.js LTS、npm、Python 3.11/3.12
- Docker 部署：安装 Docker Engine 或 Docker Desktop，并确保 `docker compose` 可用；宿主机不需要安装 Node.js
- 配置文件、生产密钥和注册邀请码准备方式见 [Docker 部署运行手册](docs/runbooks/docker-deployment.md)

### 本机开发

推荐使用仓库根目录的 `python start.py`，它会准备本地配置、迁移数据库并启动前后端和本机识别服务。手动运行请参考前面的开发启动说明；生产环境不要使用 `prisma migrate dev`。

### Docker 生产部署

Docker Compose 构建单容器，Nginx 提供前端并把 `/api` 代理给 NestJS。主机映射 8080 端口，默认绑定到 `127.0.0.1`；SQLite 数据库、附件和旧库快照写入 Docker 命名卷 `medical-data`。从代码检出到首次启动、HTTPS、升级和备份恢复的完整步骤见 [Docker 部署运行手册](docs/runbooks/docker-deployment.md)。

### 生产部署注意事项

- 生产环境不要使用示例中的 `JWT_SECRET`，应替换为高强度随机值
- SQLite 适合本地或轻量部署；如果需要多实例或更高并发，建议切换到 PostgreSQL
- Docker 部署使用 `medical-data` 命名卷持久化 SQLite 与附件，升级镜像时保留该卷并定期演练恢复
- 如使用同机反向代理，请确保将外部流量转发到宿主机 `8080` 端口

旧版开发库中的用户和病历不能自动关联到新账户。Docker 首次初始化会把源 SQLite 数据库和附件复制到 `medical-data` 卷，并另存数据库快照；后续迁移可能清空运行库中无法归属账号的业务数据。源文件和卷内快照保留，不会被迁移脚本写回或删除。详细说明见 [数据保留与首次部署](docs/runbooks/docker-deployment.md#已有本机数据的处理)。

## 文件上传说明

- 本地存储路径：`uploads/{userId}/{visitId}/{storedFileName}`
- 数据库存储相对路径，例如 `userId/visitId/file-name.pdf`
- 当前允许的 MIME 类型：
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`

在当前的 SQLite 单实例部署中，后台每 5 秒检查待清理任务，存储删除失败后约 1 分钟重试。清理任务与附件记录的删除或替换在同一 SQLite 事务中登记，待处理任务会保存在数据库中。每次写入原件前也会登记清理任务，提交附件记录后自动取消。失败任务立即进入队列。进程意外退出时，预登记任务在一小时宽限期后回收。现有数据库需先运行 `npm run prisma:migrate:deploy`，一键启动脚本会自动执行迁移。未来重建 `VisitFile` 表的迁移需同步重建清理触发器。

## S3 存储（可选）

如果要改用 S3 或兼容 S3 的对象存储，请在 `.env` 中设置：

```env
FILE_STORAGE=s3
S3_REGION=us-east-1
S3_BUCKET=my-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
# 可选，用于 MinIO 或其他 S3 兼容服务
# S3_ENDPOINT=http://localhost:9000
# S3_FORCE_PATH_STYLE=true
```

当 `FILE_STORAGE=s3` 时：

- 上传文件会写入对象存储桶
- 对象 key 仍使用 `{userId}/{visitId}/{storedFileName}` 的目录结构
- `PUT /files/:id` 会先写入新对象并更新数据库，再删除旧对象，避免中间状态造成附件丢失
- 删除附件、就诊或成员后，后台队列会按附件记录中的存储类型清理原件。删除失败会重试。

如果未显式配置 `S3_ACCESS_KEY` 与 `S3_SECRET_KEY`，当前实现会回退到 AWS SDK 默认 credential chain，便于云上部署或使用本机已有凭证。

## 备注

- Prisma schema 与迁移文件位于 `apps/server/prisma`
- Docker 首次初始化以只读方式挂载 `apps/server/uploads` 和 `apps/server/prisma`，随后将数据复制到 `medical-data` 卷；运行时数据不直接写回源码目录
- `Visit`、`DiagnosisRecord`、`Medication`、`VisitFile`、`User` 均已按当前账号隔离，跨账号访问会返回 404
