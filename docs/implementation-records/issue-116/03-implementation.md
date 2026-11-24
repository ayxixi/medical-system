# 实现

状态：已记录

- 新增 `scripts/restore_account_backup.py`，校验 ZIP/manifest/data 版本与附件关联，显示数据数量。
- 通过 `--apply` 和 `RESTORE` 交互确认追加写入，不覆盖旧记录；事务内记录归档 SHA-256，阻止同一 ZIP 字节重复导入。
- 附件先暂存，验证摘要后写入新的本地路径；出错时回滚并清理本次文件。
- 更新账号恢复手册、README、计划和文档索引。
