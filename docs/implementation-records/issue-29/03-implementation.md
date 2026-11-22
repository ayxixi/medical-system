# 实现记录

状态：已记录

- `start.py` 默认启动识别：首次生成/复用 64 位随机 API key，写入 `apps/server/.env`，保留其它配置；本地 Nest 使用 `http://127.0.0.1:8001`。
- 调用 Compose v2 启动 `recognition` profile，worker 仍只映射到宿主机 loopback。Compose 子进程所需的配置在内存中提供，不要求用户维护第二份环境文件。
- `preload_models.py` 在模型命名卷中写入按 Whisper 模型区分的就绪标志；首次联网下载 RapidOCR/Whisper 模型，后续启动跳过预下载。
- 脚本只停止本次启动的 worker；此前已运行的 worker 不停止。Ctrl+C 时保留模型卷和密钥配置。
- `--no-recognition` 清空当前运行进程中的 worker 地址，不要求 Docker，也不修改用户现有 env 文件。
