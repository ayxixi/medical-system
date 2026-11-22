# 实现记录

状态：已记录

- `start.py` 默认启动识别：首次生成/复用 64 位随机 API key，写入 `apps/server/.env`，保留其它配置；本地 Nest 使用 `http://127.0.0.1:8001`。
- 脚本在 `apps/recognition/.venv` 创建 Python venv，并按 requirements.txt 安装依赖；文件未变化时跳过重复安装。
- `preload_models.py` 在 `apps/recognition/models` 写入按 Whisper 模型区分的就绪标志；首次联网下载 RapidOCR/Whisper 模型，后续启动跳过预下载。
- 本地 worker 只绑定宿主机 loopback，由启动脚本管理进程；Ctrl+C 停止 worker，但保留虚拟环境、模型缓存和密钥配置。
- `--no-recognition` 跳过本次启动的 worker，不修改用户现有 env 文件。Docker Compose recognition profile 保留用于部署环境。
- 3000、5173 或 8001 被占用时启动前会失败并提示检查占用进程，不会自动结束其他程序。
