# 实现记录

状态：已记录

- NestJS 新增 JWT 保护的 `/recognition/ocr`、`/recognition/transcribe`，媒体仅暂存内存并通过共享 API key 转发；限制 MIME、10 MB 文件大小和请求超时，不记录正文。
- Python FastAPI worker 使用 RapidOCR 与 faster-whisper；worker 不映射宿主机端口，仅加入 Compose 内部网络；识别文本不落库，临时录音清理。
- Compose 增加默认关闭的 `recognition` profile、专用 bridge 网络、仅 loopback 宿主机端口映射与独立模型卷；手动功能不依赖 worker。
- 前端在新增就诊备注、编辑就诊备注和新增/编辑诊断表单加入拍照/选图、最长 60 秒浏览器录音和结果回填；保留用户编辑及原保存动作。
- README、环境配置、Nginx 超时、计划与交付记录同步。
