# 设计与拆分

状态：已记录

1. NestJS 增加 JWT 保护的识别代理 API，使用 Multer 内存接收媒体并按实际类型和大小白名单校验；仅将文件流转发到配置的内网 worker，设置请求超时，不记录请求/结果正文。
2. Python FastAPI worker 独立运行；共享 API key 校验；图片用 RapidOCR、语音用 faster-whisper，模型可配置和缓存；worker 不映射主机端口。
3. Compose 使用可选 `recognition` profile 和私有 bridge 服务（不发布主机端口），默认主应用不依赖 worker；模型缓存通过独立卷持久化，允许首次下载模型。
4. 前端增加重用的识别控件：图片选择/相机上传、浏览器录音(最长 60 秒)、处理状态和结果回填，不自动保存。
5. 同步 README、配置模板、实施计划和六阶段记录。
