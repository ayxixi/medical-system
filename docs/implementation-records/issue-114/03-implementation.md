# 实现

状态：已记录

- 账号 ZIP 导出为 `data.json`、`README.txt` 与各附件生成 SHA-256 和字节数清单，并将版本化 `manifest.json` 放到 ZIP 末尾。
- 新增 `scripts/verify_export_manifest.py`，不解压即可检查 ZIP 条目、路径安全、清单、大小和 SHA-256。
- 更新导出页、README、运行手册、文档索引和计划。
