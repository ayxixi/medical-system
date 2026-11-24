# 设计与拆分

状态：已记录

`ExportModule` 已导入 `FileModule`，但 Nest 模块只允许注入被导入模块显式导出的 provider。将 `FileService` 加入 `FileModule.exports`，保持其它模块结构和运行方式不变。

任务：更新模块导出；构建后端；记录评审及发布状态。
