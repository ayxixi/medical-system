# 实现记录

状态：已记录

- 添加 `requests>=2.32,<3` 作为识别 worker 的直接依赖。requirements 文件变化使本地启动脚本自动重新执行 pip install 并补齐缺少的包。
- `preload_models.py --check` 现在只读取模型标记；RapidOCR/faster-whisper 在确认需要预加载模型后才导入，避免缓存探测阶段产生重复导入 traceback。
