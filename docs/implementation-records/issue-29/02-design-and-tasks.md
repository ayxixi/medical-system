# 设计与任务拆分

状态：已记录

1. start.py 维护 apps/server/.env 中的本地 worker 地址和随机 API key，更新时保留其它环境配置。
2. 用 Python venv 自动创建隔离环境并依据 requirements.txt 安装依赖；依赖文件哈希未变化时跳过重复安装。
3. 将模型缓存保存在 apps/recognition/models，使用按 Whisper 模型命名的就绪标志避免重复预下载。
4. 在本机 loopback 启动 worker，由启动脚本管理其进程生命周期。
5. 增加 `--no-recognition`，说明本机开发无须 Docker，更新 README 和六阶段记录；保留 Compose 供部署使用。
