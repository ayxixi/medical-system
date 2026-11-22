# 验证记录

状态：已记录

- Web `npm run build`：通过。
- Web `npm run lint`：通过。
- Server `npm run prisma:generate`、`npm run build`：通过。
- Server Jest：16 个套件、110 个测试全部通过，包括旧账号邮箱登录、设置用户名和用户名登录 E2E。
- SQLite 临时旧库迁移验证：旧账号、邮箱、密码哈希保留；新列允许旧账号为空，唯一索引拒绝重复用户名。
- `python3 scripts/check_delivery.py` 对 issue-51、issue-53：通过。
- `git diff --check`：通过。
