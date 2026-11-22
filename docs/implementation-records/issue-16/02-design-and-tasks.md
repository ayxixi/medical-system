# 设计与拆分

状态：已记录

- UserService：测试增删改查、账号隔离、未找到响应与最后一个成员保护。
- UserRepository：断言 Prisma 查询始终包含 accountId，并覆盖更新/删除命中与未命中。
- AttachmentCleanupService：使用 Prisma 和存储服务 mock 覆盖活动写入、共享引用、文件删除、失败重试和并发批次合并。
