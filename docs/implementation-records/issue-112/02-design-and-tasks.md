# 设计与拆分

状态：已记录

使用 Python 标准库 `sqlite3` immutable/read-only 打开用户明确指定的数据库，查询 `VisitFile` 与 `AttachmentCleanup` 元数据；扫描指定目录中的普通文件，不跟随符号链接。按相对路径对照，输出计数和相对路径，不读取医疗正文。

清理队列文件独立报告，不作为孤儿候选。S3/MinIO 暂不连接。工具只盘点，不自动修复或删除。
