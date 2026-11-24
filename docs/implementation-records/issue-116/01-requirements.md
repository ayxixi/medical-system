# 需求

状态：已记录

关联 [Issue #116](https://github.com/ayxixi/medical-system/issues/116)。从本系统带 manifest 的 ZIP 备份向指定 SQLite 账号追加成员、就诊、诊断、用药、病程、提醒和附件，保留原数据。

默认只校验和预览；显式 `--apply` 并输入确认词后才写入。目标限定本地附件存储；拒绝不支持的数据版本、摘要不符、路径不安全和重复导入。
