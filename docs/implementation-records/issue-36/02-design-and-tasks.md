# 设计与任务拆分

状态：已记录

1. 在 `apps/recognition/requirements.txt` 添加 requests 直接依赖；启动器依赖哈希变化会触发 pip 安装/补齐。
2. 调整 `preload_models.py`，先检查缓存标记，再导入 OCR/语音模型库。
3. 更新六阶段交付记录。
