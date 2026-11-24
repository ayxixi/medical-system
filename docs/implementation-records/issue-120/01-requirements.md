# 需求

状态：已记录

关联 [Issue #120](https://github.com/ayxixi/medical-system/issues/120)。改善 SQLite 账号 ZIP 追加恢复前的容量和目标数据量预览。

验收：只显示各类既有/待追加记录数量、ZIP 与附件字节数和附件存储可用容量；不足或无法检测时不得写入；不泄露业务正文、姓名、附件名或路径；应用写事务前再次检查空间和重复 ZIP。
