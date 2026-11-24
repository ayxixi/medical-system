# 本地附件只读盘点

`scripts/audit_attachments.py` 用于把 SQLite `VisitFile` 记录与本地附件目录做只读对照。数据库以 SQLite immutable/read-only 模式打开，工具不会创建或改写数据库，也不会删除、移动或修复文件。immutable 模式不读取 WAL 日志，因此生产扫描必须使用已 checkpoint 的一致性备份副本；不要直接盘点正在运行的数据库。盘点结果中的孤儿候选需要人工核对并先备份；不能仅凭报告删除。

## 开发环境

从仓库根目录运行：

```bash
python scripts/audit_attachments.py \
  --database apps/server/prisma/local-dev.db \
  --uploads apps/server/uploads/local-dev
```

Windows PowerShell 可将命令写成一行：

```powershell
python scripts/audit_attachments.py --database apps/server/prisma/local-dev.db --uploads apps/server/uploads/local-dev
```

需要机器可读结果时添加 `--json`。生产环境须明确传入真实 SQLite 数据库和附件目录路径；先暂停应用写入并通过 SQLite backup/checkpoint 流程生成一致性副本，再扫描副本。附件目录也应使用同一时点的备份副本。

## 报告说明

- `missing`：数据库指向的本地附件未找到。
- `orphaned`：目录中的普通文件未被数据库引用，也不在附件清理队列中。它只是待复核候选。
- `pathMismatches`：数据库路径不安全、包含符号链接，或存储名与路径文件名不一致。
- `pendingCleanupFiles`：已登记清理队列的本地文件，不计入孤儿候选。
- `skippedSymlinks`：扫描跳过的符号链接，不会跟随链接读取目标。
- `s3ReferencesNotScanned`：数据库中的 S3 记录数量。此工具不连接 S3/MinIO。

工具只输出文件相对路径、计数和必要的本地数据库/目录位置，不读取或打印病历内容。扫描期间若应用仍在上传、替换或清理附件，结果可能反映不同时间点的状态；对生产数据盘点应在一致性备份副本上进行。
