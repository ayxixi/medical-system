# 医疗记录系统

这是一个全栈医疗记录系统：后端基于 NestJS（位于 `apps/server/`），前端基于 React + Vite + Ant Design（位于 `apps/web/`）。优先支持本地部署，同时保留后续迁移到 Docker、PostgreSQL 和 S3 兼容对象存储的扩展路径。

## 当前功能范围

- 账号注册与登录（JWT）
- 家庭成员档案管理
- 就诊记录管理
- 诊断记录管理
- 用药信息管理
- 文件上传、替换、查询与删除
- 可选自托管中文题图 OCR 与语音转写；结果回填诊断/备注草稿，用户确认后保存
- 已认证业务写操作审计（不记录请求正文或附件内容）
- 当前账号医疗记录 JSON 导出（含附件元数据，不含附件原件）
- 前端登录 / 注册、受保护路由与业务页面（成员、就诊、诊断、用药、附件）

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

## 前端启动

前端工程位于 `apps/web/`。首次启动：

```bash
cd apps/web
npm install
npm run dev
```

开发地址默认为 `http://localhost:5173`。Vite 已配置代理：前端的 `/api/*` 请求会被转发到 `http://localhost:3000`，因此本地开发只需保证后端在 3000 端口运行即可，无需额外的 CORS 配置。

生产部署时可通过环境变量 `VITE_API_BASE_URL` 指定后端地址，例如：

```env
VITE_API_BASE_URL=https://api.example.com
```

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

### 前端发布注意事项

- 生产构建前请确认 `VITE_API_BASE_URL` 已正确指向后端地址
- 前端是单页应用（SPA），静态服务器或 Nginx 需要把非静态资源请求回退到 `index.html`
- 如果与后端分域部署，请确保后端允许对应来源访问，或通过反向代理把前后端收敛到同一域名下

### 前端使用流程

前后端都启动后，推荐按下面顺序验证页面功能：

1. 打开前端地址，首次进入先注册账号
2. 登录后进入首页，检查账号信息与统计卡片是否正常显示
3. 进入“家庭成员”页面，新增至少一个成员
4. 进入“就诊记录”页面，新增就诊
5. 在就诊详情页继续新增诊断、用药，并上传或替换附件

当前前端已提供以下页面：

- `/login`：登录页
- `/register`：注册页
- `/`：首页
- `/users`：家庭成员管理
- `/visits`：就诊列表
- `/visits/:id`：就诊详情

## 已实现接口

除 `POST /auth/register` 和 `POST /auth/login` 外，其余接口都需要携带：

```text
Authorization: Bearer <accessToken>
```

### 认证接口

- `POST /auth/register`：注册账号（邮箱 + 密码），并同时创建第一个家庭成员
- `POST /auth/login`：登录并获取 JWT
- `GET /auth/me`：获取当前账号信息
- `POST /auth/change-password`：验证旧密码后修改密码，并撤销所有旧会话
- `GET /export`：导出当前账号 JSON 数据（版本化；不包含密码哈希和附件原件）

### 用户接口

- `POST /users`：为当前账号新增家庭成员
- `GET /users`：查询当前账号下的家庭成员列表
- `GET /users/:id`
- `PATCH /users/:id`：修改成员姓名
- `DELETE /users/:id`：删除成员（账号下至少保留一个用户）

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

Docker Compose 默认不启动识别依赖。生产部署如需识别，可在 `deploy/.env` 设置随机 32 字符以上的 `RECOGNITION_API_KEY`、`RECOGNITION_WORKER_URL=http://recognition:8000`，然后使用 `docker compose --env-file deploy/.env --profile recognition up --build -d`。worker 只加入应用专用 bridge，宿主机端口仅绑定到 `127.0.0.1:8001`（可通过 `RECOGNITION_WORKER_PORT` 调整），不接受公网连接。模型预下载需要出站网络；可运行 `docker compose --env-file deploy/.env --profile recognition run --rm recognition python /app/preload_models.py`，模型保存到 `recognition-models` 卷。开发环境无需 Docker，直接运行仓库根目录的 `python start.py` 即可安装本地依赖并启动 worker。关闭识别可停止 recognition profile 并清空识别地址配置，普通应用不依赖 worker。

### 数据导出

`GET /export` 返回 `{ schemaVersion, exportedAt, account, users }`。成员下包含就诊、诊断、用药和附件元数据。导出受当前账号权限约束；附件仅包含原始文件名、MIME 类型、大小及记录时间，不包含文件内容、存储文件名或内部路径。响应不包含密码哈希和令牌信息。

### 操作审计

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

- 安装 Node.js 18 或更高版本
- 安装 npm
- 如需使用 Docker 部署，提前安装 Docker Desktop，并确保 `docker compose` 可用
- 确认 `apps/server/.env` 已存在且 `JWT_SECRET` 已设置为长度不少于 16 位的随机字符串

### 本地部署

在仓库根目录执行以下步骤：

```bash
cd apps/server
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

启动成功后，服务默认监听：

```text
http://localhost:3000
```

如果是首次部署，建议按下面顺序验证：

1. 注册账号获取 `accessToken`
2. 使用 `accessToken` 访问 `/users`
3. 创建家庭成员后再创建就诊记录与附件

认证调用示例：

```bash
# 1. 注册，返回 { accessToken, account, defaultUserId }
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"hunter2hunter2","name":"Alice"}'

# 2. 或后续登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"hunter2hunter2"}'

# 3. 使用 token 访问受保护接口
curl http://localhost:3000/users -H "Authorization: Bearer <accessToken>"
```

### Docker 生产部署

Docker Compose 构建单容器，容器内 Nginx 提供前端并把 `/api` 代理给 NestJS。主机只映射 8080 端口，默认绑定到 `127.0.0.1`，可接入同机 Caddy 或 Nginx 并由反向代理提供 HTTPS。SQLite 数据库和附件写入 Docker 命名卷 `medical-data`。

准备 `apps/server/.env` 并设置生产密钥后，在仓库根目录运行：

```bash
cp deploy/.env.example deploy/.env
# 按需调整 deploy/.env，并确保注册邀请码是独立的随机值
docker compose --env-file deploy/.env up --build -d
docker compose --env-file deploy/.env ps
```

首次部署到已有工作目录时，如果命名卷还没有数据库，入口脚本会从 `apps/server/prisma/dev.db` 导入一份副本，并把旧附件复制到数据卷；原数据库和附件目录以只读方式挂载，不会被改写。旧数据库副本另存于卷内 `/data/legacy-original/dev.db`。当前 `Account` 迁移会清空无法关联账户的旧记录，因此新运行库可能没有旧记录；原库副本与附件仍保留，便于后续导入工具处理。确认迁移和附件后再考虑清理源文件及快照。

Compose 强制配置邀请注册码，且不直接将 HTTP 服务暴露到外网。若反向代理位于另一台机器，需显式将 `APP_BIND_ADDRESS` 设为受防火墙限制的私网地址。只有请求经过可信代理时才设置 `TRUST_PROXY=true`。

健康检查会确认 Nest 和数据库均可查询。每次启动会先运行数据库迁移。备份数据库、旧库快照和本地附件：

```bash
deploy/scripts/backup.sh
```

恢复前先确认备份来源。恢复会停止服务并覆盖当前数据库与附件：

```bash
deploy/scripts/restore.sh backups/medical-backup-时间戳.tar.gz
```

备份文件和 SHA256 清单应转存到与应用主机分离且访问受控的位置。恢复脚本先校验 SHA256 并解压到暂存目录，通过文件检查后才切换数据库和附件；旧数据暂存在数据卷的 `/data/.restore-rollback`，完成验证后再按维护流程清理。服务重新启动后会检查健康状态。首次上线前应在独立环境实际演练备份与恢复。

### 生产部署注意事项

- 生产环境不要使用示例中的 `JWT_SECRET`，应替换为高强度随机值
- SQLite 适合本地或轻量部署；如果需要多实例或更高并发，建议切换到 PostgreSQL
- Docker 部署使用 `medical-data` 命名卷持久化 SQLite 与附件，升级镜像时保留该卷并定期演练恢复
- 如使用同机反向代理，请确保将外部流量转发到宿主机 `8080` 端口

> 2026-04-29 引入 `Account` 与 `User.accountId` 的迁移会清空旧的
> `User`、`Visit`、`DiagnosisRecord`、`Medication`、`VisitFile` 开发数据。
> 对已有开发库执行 `npm run prisma:migrate:dev` 时，请预期旧数据会被重建或清空。

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
- 当前 Docker Compose 同时挂载了 `apps/server/uploads` 和 `apps/server/prisma`
- `Visit`、`DiagnosisRecord`、`Medication`、`VisitFile`、`User` 均已按当前账号隔离，跨账号访问会返回 404
