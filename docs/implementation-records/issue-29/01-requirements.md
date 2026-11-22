# 需求与验收

状态：已记录

关联 Issue #29。`python start.py` 默认自动生成/复用识别共享密钥、启动仅 loopback 可访问的可选 Python worker，并在首次运行时准备模型缓存。使用者不再手工编辑 worker URL/API key 或运行 Compose 命令。重复运行复用配置和模型。`python start.py --no-recognition` 可以跳过 Docker 与识别服务，只运行原有核心功能。数据库、附件路径和已有用户配置不得清理或重建。
