# 医疗记录系统

这是一个全栈医疗记录系统：后端基于 NestJS（位于 `apps/server/`），前端基于 React + Vite + Ant Design（位于 `apps/web/`）。优先支持本地部署，同时保留后续迁移到 Docker、PostgreSQL 和 S3 兼容对象存储的扩展路径。

## 当前功能范围

- 账号注册与登录（JWT）
- 家庭成员档案管理
- 就诊记录管理
- 诊断记录管理
- 用药信息管理
- 文件上传、替换、查询与删除
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

安装 Python 3、Node.js LTS 和 npm 后，在仓库根目录执行：

```bash
python start.py
```

如果本机命令是 `python3` 或 Windows 的 `py`，可换用对应命令。
缺少依赖时脚本会安装依赖，首次运行需要联网。脚本会在缺少
`apps/server/.env` 时生成配置和随机 JWT 密钥，并初始化独立的
`apps/server/prisma/local-dev.db`。附件保存在 `apps/server/uploads/local-dev/`。

启动后打开 `http://127.0.0.1:5173/`，首次使用可在页面注册。
后端使用本机 3000 端口，按 Ctrl+C 停止前后端。重复运行会继续使用同一份开发数据。

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
- `PUT /files/:id` 以新文件替换现有附件（先写入新文件并更新 DB，再删除旧文件）
- `DELETE /files/:id`

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

### Docker 部署

在项目根目录执行：

```bash
docker compose up --build
```

当前 `docker-compose.yml` 会：

- 构建 `docker/Dockerfile`
- 暴露宿主机 `3000` 端口到容器 `3000`
- 挂载 `apps/server/uploads` 到容器 `/app/uploads`
- 挂载 `apps/server/prisma` 到容器 `/app/prisma`
- 从 `apps/server/.env` 读取环境变量

容器启动命令为：

```bash
npx prisma migrate deploy && npm run start:prod
```

这表示容器启动时会先执行 Prisma 迁移，再以生产模式启动应用。

### 生产部署注意事项

- 生产环境不要使用示例中的 `JWT_SECRET`，应替换为高强度随机值
- SQLite 适合本地或轻量部署；如果需要多实例或更高并发，建议切换到 PostgreSQL
- 如果通过 Docker 持久化数据，务必保留 `apps/server/prisma` 和 `apps/server/uploads` 对应挂载目录
- 如使用反向代理，请确保将外部流量转发到应用的 `3000` 端口

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
- `DELETE /files/:id` 会同时删除对象存储中的文件对象

如果未显式配置 `S3_ACCESS_KEY` 与 `S3_SECRET_KEY`，当前实现会回退到 AWS SDK 默认 credential chain，便于云上部署或使用本机已有凭证。

## 备注

- Prisma schema 与迁移文件位于 `apps/server/prisma`
- 当前 Docker Compose 同时挂载了 `apps/server/uploads` 和 `apps/server/prisma`
- `Visit`、`DiagnosisRecord`、`Medication`、`VisitFile`、`User` 均已按当前账号隔离，跨账号访问会返回 404
