# 验证

状态：已记录

后端 `npm run build` 通过，`npm test -- --runInBand` 通过（13 个套件、87 项测试）。Compose 配置解析、三个 shell 脚本语法、SHA256 校验、恢复暂存/切换/旧数据保留模拟、旧数据库和附件导入模拟通过，六阶段交付检查通过。

Docker 镜像构建已尝试，但镜像内两阶段的 `npm ci` 未在本执行环境完成；独立本机安装遇到 npm registry tarball 校验和缓存目录错误。容器健康检查未能执行，因此 Docker 镜像还没有端到端验收。PR 需在具备正常 npm registry 访问的 CI 或部署环境补做镜像构建和启动检查。
