# 需求

状态：已记录

关联 [Issue #110](https://github.com/ayxixi/medical-system/issues/110)。修复 `python start.py --lan` 启动时 Nest 无法注入 `ExportService` 所需 `FileService` 的错误。

验收：`FileModule` 导出 `FileService`，后端可成功构建。
