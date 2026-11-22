# 实现记录

状态：已记录

- `AuditLog` 模型和只增量创建表/索引的 SQLite 迁移。
- 全局 `AuditInterceptor` 捕获通过 JWT 的 POST/PATCH/PUT/DELETE 操作；只保存允许的元数据，写入失败由 `AuditService` 吞掉并告警。
- `GET /export` 使用当前账号 ID 查询账号关联成员、就诊、诊断、用药及附件元数据；显式字段选择排除 passwordHash、tokenVersion、storedName、relativePath 和文件内容。
- README 与 `docs/PLAN.md` 已同步接口、隐私范围和后续扩展方向。
