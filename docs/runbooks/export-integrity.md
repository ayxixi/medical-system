# 账号 ZIP 备份完整性校验

账号 ZIP 备份的 `manifest.json` 为 `data.json`、`README.txt` 和每个附件记录归档路径、未压缩字节数及 SHA-256。校验工具以流方式读取 ZIP，不解压到磁盘：

```bash
python scripts/verify_export_manifest.py "path/to/medical-records.zip"
```

Windows PowerShell 示例：

```powershell
python scripts/verify_export_manifest.py "D:\Backups\电子病历完整备份.zip"
```

成功时会报告清单文件数，不会把归档文件名输出到终端。工具也会检查归档路径安全、重复项、清单与 ZIP 条目是否一致、文件大小和摘要。校验失败会以非零状态退出。

此校验用于发现下载、复制或存储造成的文件损坏。清单与归档一起保存，不能证明备份来自可信发布者，也不能防止有人同时修改文件和清单；需要来源真实性时，应把备份和独立保存的数字签名/摘要配合使用。
