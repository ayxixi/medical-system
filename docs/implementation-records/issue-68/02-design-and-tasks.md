# 设计与拆分

状态：已记录

- 用 service 单测覆盖创建/成员校验、单次/每日完成、snooze、计划修改、无效 IANA 时区和 DST 缺失本地时间。
- 用 repository 单测固定所有读写的 `user.accountId` 过滤，以及 includeInactive 对 completedAt 的行为。
- 扩展现有临时 SQLite 账号隔离 e2e，验证 Alice/Bob 对提醒列表、新建、更新、action、删除和未认证请求的边界。
- 定向运行提醒 service/repository 单测及账号隔离 e2e；构建、lint 和交付检查。
- 目标手机及目标 Docker 主机检查作为外部发布验收，不以模拟测试代替。
