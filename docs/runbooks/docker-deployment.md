# Docker Compose 部署运行手册

本文描述当前仓库的单机 Docker Compose 发布方式。部署形态是一个应用容器（Nginx 前端 + NestJS API）和一个可选的本机 OCR/语音识别容器。默认数据库为 SQLite，数据库与本机附件保存在命名卷中。

> 当前 Compose、Dockerfile、入口迁移和健康检查已实现；镜像构建及目标主机端到端验收仍需实际执行。SQLite 单实例适合个人或小规模使用。不要把此配置直接当作高可用或多实例部署方案。

当前发布流程是在目标服务器从源码构建镜像；仓库尚未配置 CI 自动构建并推送 Docker Hub/GHCR 镜像。若需镜像仓库发布流程，应另行配置镜像标签、凭证和 CI 工作流。

## 1. 主机准备

- Linux 服务器或 Docker Desktop 主机，安装 Docker Engine / Docker Desktop 和 Docker Compose v2（`docker compose` 命令）。
- 有 GitHub 仓库读取权限的 Git 客户端，或已下载的源码包。
- 首次构建需要网络访问 npm registry、Docker 基础镜像源及 Python 包索引（启用识别时）。识别模型首次预下载还需要访问模型源。
- 为部署准备专用且高强度的 JWT 密钥和注册邀请码。不要复用仓库示例值，也不要将 `.env` 文件提交到 Git。

查看版本：

```bash
docker --version
docker compose version
```

## 2. 获取代码并准备配置

在服务器克隆仓库，或进入已解压的仓库根目录：

```bash
git clone https://github.com/ayxixi/medical-system.git
cd medical-system
```

Windows PowerShell 可用 `Copy-Item` 代替下面的 `cp`。

```bash
cp deploy/.env.example deploy/.env
cp apps/server/.env.example apps/server/.env
```

编辑 `deploy/.env`：

- `APP_BIND_ADDRESS=127.0.0.1`：默认只让本机反向代理访问，适合同机部署 Caddy/Nginx。
- `REGISTRATION_MODE=invite`：生产默认要求邀请码注册。
- `REGISTRATION_INVITE_CODES`：替换为随机、未公开的注册码，可用逗号分隔多个码。
- `TRUST_PROXY=false`：只有应用确实位于可信反向代理后，并且代理正确覆盖转发头时才改为 `true`。
- OCR/语音变量先保持为空；启用方法见后文。

编辑 `apps/server/.env` 至少设置：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/data/medical.db
FILE_STORAGE=local
UPLOAD_PATH=/data/uploads
MAX_FILE_SIZE_MB=10
JWT_SECRET=替换为至少32字节随机值
JWT_EXPIRES_IN=1d
REGISTRATION_MODE=invite
```

可在 Linux 用 `openssl rand -hex 32` 生成随机密钥；Windows PowerShell 可用：

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

旧版 Windows PowerShell 可用两个随机 GUID 拼接生成 64 位十六进制值：

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

把输出填入 `JWT_SECRET`，注册邀请码也应单独生成。Compose 会从 `deploy/.env` 设置最终的注册模式、邀请码与代理信任配置；`apps/server/.env` 仍是必需文件，其中提供 JWT 等应用配置。

## 3. 构建并启动

在仓库根目录执行：

```bash
docker compose --env-file deploy/.env up --build -d
docker compose --env-file deploy/.env ps
docker compose --env-file deploy/.env logs --tail=100 app
```

查看健康状态：

```bash
curl http://127.0.0.1:8080/health
```

应返回 `{"status":"ok"}`。容器入口在每次启动时先执行 `prisma migrate deploy`，再启动 NestJS 与 Nginx。第一次构建需要下载依赖，可能较久；之后启动复用已构建镜像。

默认只能从部署主机访问 `http://127.0.0.1:8080`。同机 Caddy/Nginx 可作为 TLS 反向代理，将流量转发到该地址。需要手机或互联网访问时，应配置域名、HTTPS 证书与反向代理；不要把未加密的应用端口直接暴露到公网。若反向代理在另一台机器，才将 `APP_BIND_ADDRESS` 改为服务器的私网地址，并用防火墙限制来源。若明确需要在局域网直接访问，可设为 `0.0.0.0` 并限制防火墙，但浏览器录音等媒体 API 通常要求 HTTPS。

同机使用 Caddy 时，可在 Caddyfile 配置域名并反代到本地应用端口，例如：

```caddyfile
medical.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

将 `medical.example.com` 换成自己的域名，并确保 DNS 指向服务器、外部防火墙开放 80/443；Caddy 才能签发和续期 HTTPS 证书。Docker Compose 的 8080 端口仍保持 loopback 绑定。

## 4. 首次注册与升级

首次打开站点后使用 `deploy/.env` 中配置的邀请码注册。新账号使用用户名登录；升级前没有用户名的账号仍可暂用邮箱登录，并在登录后设置用户名。

发布新版本前先备份数据，更新代码后在仓库根目录执行：

```bash
git pull --ff-only
docker compose --env-file deploy/.env up --build -d
docker compose --env-file deploy/.env ps
curl http://127.0.0.1:8080/health
```

保持 `medical-data` 命名卷不变。不要在升级时运行 `docker compose down -v`，该命令会删除卷和其中的运行数据库、附件及旧库快照。普通 `docker compose down` 不删除命名卷。

## 5. 可选启用本机识别

在 `deploy/.env` 中设置：

```env
RECOGNITION_WORKER_URL=http://recognition:8000
RECOGNITION_API_KEY=替换为至少32字符的随机密钥
```

Compose 会把 `deploy/.env` 中的 `RECOGNITION_API_KEY` 同时传给应用和 worker。然后构建并启动识别 profile：

```bash
docker compose --env-file deploy/.env --profile recognition build recognition
docker compose --env-file deploy/.env --profile recognition run --rm recognition python /app/preload_models.py
docker compose --env-file deploy/.env --profile recognition up --build -d
docker compose --env-file deploy/.env ps
```

模型数据持久化在 `recognition-models` 命名卷。worker 只在 Compose 内部网络提供给应用，宿主机映射端口固定绑定在 loopback；不要为识别 worker 配置公网入口。模型下载需要出站网络；下载完成后识别推理在自托管 worker 上执行。

关闭识别服务时：

```bash
docker compose --env-file deploy/.env --profile recognition stop recognition
```

同时清空 `deploy/.env` 中的 `RECOGNITION_WORKER_URL` 和 `RECOGNITION_API_KEY`，再停止识别服务并重新创建 app 容器：

```bash
docker compose --env-file deploy/.env --profile recognition stop recognition
docker compose --env-file deploy/.env up -d --force-recreate app
```

模型卷保留，便于再次启用。若要释放模型磁盘空间，先确认不再需要后再单独删除该卷；不要使用 `down -v` 清理。

## 6. 已有本机数据的处理

当 `medical-data` 卷尚无 `/data/medical.db`，入口脚本会检查仓库中的 `apps/server/prisma/dev.db`。若存在，会把数据库副本保存为卷内 `/data/legacy-original/dev.db`，再复制一份到运行位置；旧 `apps/server/uploads` 内容也复制到卷内 `/data/uploads`。仓库源文件按只读方式挂载，不会被入口脚本改写。

之后启动时会对运行库副本应用现有迁移。注意：账号/成员模型迁移无法推断旧开发数据属于哪个登录账号；旧数据可能从运行库中清空或不可见。原始开发数据库快照和复制的附件仍留在 `medical-data` 卷，作为后续人工或导入工具处理的来源。此保留机制不是旧账号和病历的自动迁移。当前项目未提供将无主旧数据自动导入新账号的工具。

已存在的 `medical-data` 卷不会再次从源码目录导入，之后只使用卷内运行库与附件。首次启动前先确认 `apps/server/prisma/dev.db` 与 `apps/server/uploads` 是期望的输入；若是正式数据，先另做离机备份并在副本上演练。

## 7. 备份与恢复

备份脚本会从运行容器读取 SQLite 数据库、附件和旧库快照，并生成归档与 SHA256 文件：

```bash
deploy/scripts/backup.sh
```

恢复会停止 app 并覆盖卷内当前数据库、附件及旧库快照；执行前需确认归档来源并保留当前状态的备份：

```bash
deploy/scripts/restore.sh backups/medical-backup-时间戳.tar.gz
```

恢复脚本校验 SHA256、暂存并检查归档，然后切换数据；被替换的数据保留在卷内 `/data/.restore-rollback`，不会自动清理。备份归档及 `.sha256` 文件应复制到与应用主机分离、访问受控的位置。首次上线前在独立环境演练恢复。

## 8. 常用运维命令

```bash
# 查看容器状态
docker compose --env-file deploy/.env ps

# 查看日志
docker compose --env-file deploy/.env logs -f app

# 重启应用
docker compose --env-file deploy/.env restart app

# 停止服务（保留命名卷）
docker compose --env-file deploy/.env down

# 查看 Docker 卷名称
docker volume ls
```

遇到启动失败，先查看 `app` 日志和 `docker compose ps` 的健康状态；如迁移失败，不要删除数据卷或手工改库，先备份并检查迁移错误信息。
