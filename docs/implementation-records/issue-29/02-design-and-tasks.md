# 设计与任务拆分

状态：已记录

1. start.py 维护 apps/server/.env 中的本地 worker 地址和随机 API key，更新时保留其它环境配置。
2. 使用 Docker Compose v2 启动 recognition profile；给 Compose 子进程注入 sidecar 所需变量，worker 端口维持 127.0.0.1 绑定。
3. 在持久化模型卷设置按 Whisper 模型命名的就绪标志；首次下载 RapidOCR/Whisper 模型，后续启动跳过下载。
4. 停止脚本启动的 worker，但保留 Compose 容器/模型卷和配置；检测并尊重已有运行 worker。
5. 增加 `--no-recognition`，更新 README 和六阶段记录。
