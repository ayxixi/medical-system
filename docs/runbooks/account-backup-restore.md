# 从账号 ZIP 备份追加恢复

`scripts/restore_account_backup.py` 将带 `manifest.json` 的账号 ZIP 备份追加到本地 SQLite 账号。它不会覆盖或删除目标账号已有记录和附件。默认只校验并预览，只有加入 `--apply` 并在交互提示中输入 `RESTORE` 才会写入。

## 准备

1. 确认归档来自可信位置。SHA-256 清单可发现文件意外损坏，但不能证明归档来源。
2. 停止系统进程（例如退出 `python start.py --lan`），确保没有其它进程写入数据库。
3. 备份目标 SQLite 数据库和附件目录；建议将备份复制到另一位置。
4. 使用当前迁移完成的 SQLite 数据库与本地附件存储。目标附件目录必须已经存在。

预览以 immutable/read-only 模式打开数据库。若数据库旁边仍有非空 `-wal` 文件，工具会拒绝继续，以免读取到不完整快照；应用停止后先完成 SQLite checkpoint，再重新运行。ZIP 的未压缩总大小上限为 100 GiB，`data.json` 上限为 256 MiB。

## 先预览

在仓库根目录运行。以下路径适用于 `start.py` 默认配置；若 `.env` 使用其它数据库或 `UPLOAD_PATH`，请传入实际路径。`--account` 可填目标账号 ID、用户名或邮箱。

```powershell
python scripts/restore_account_backup.py `
  --archive "D:\Backups\medical-records.zip" `
  --database "apps/server/prisma/local-dev.db" `
  --uploads "apps/server/uploads/local-dev" `
  --account "登录用户名"
```

默认是预览模式。工具会校验 manifest、SHA-256、ZIP 路径、数据版本、附件映射和目标账号，并显示成员、就诊、诊断、用药、病程、提醒、附件的数量；不会写数据库或附件。

## 明确确认后追加恢复

确认预览数量和目标账号无误，且已停止应用、完成备份后，追加 `--apply` 重新运行相同命令：

```powershell
python scripts/restore_account_backup.py `
  --archive "D:\Backups\medical-records.zip" `
  --database "apps/server/prisma/local-dev.db" `
  --uploads "apps/server/uploads/local-dev" `
  --account "登录用户名" `
  --apply
```

在提示中输入 `RESTORE` 才会继续。工具为导入数据创建新 ID，把记录关联到指定账号，并将附件写入新的本地路径。目标账号的原有资料保留；同一份 ZIP 字节内容再次导入会被拒绝。导入批次只在 `AuditLog` 留存归档 SHA-256，不保存病历正文。

若写入过程中失败，数据库事务会回滚，本次已落盘的新附件会清理。若进程或主机在提交期间被强制终止，先保留当前目录和数据库副本，再人工复核；不要直接删除 `.restore-stage-*` 或孤儿附件。确认恢复成功后再启动应用。

## 边界

- 仅支持本系统 schemaVersion 1 且带 manifest 的账号 ZIP。
- 仅支持 SQLite 和本地附件目录；S3/MinIO 不支持。
- 不适用于 Docker `medical-data` 命名卷；容器整库恢复请使用 [Docker 部署手册的恢复流程](./docker-deployment.md#7-备份与恢复)。
- 这是追加导入，不是覆盖还原。相同字节的 ZIP 会阻止重复导入；重新导出的 ZIP 具有不同导出时间，可能包含相同记录，因此不要把重复导出的同一批资料重复导入。
- 归档清单不作数字签名。只有在确认归档来源可信后才恢复。
