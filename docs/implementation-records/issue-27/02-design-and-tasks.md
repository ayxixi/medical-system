# 设计与任务拆分

状态：已记录

将 Joi 条件的 `is` 子 schema 设为 required，使缺失/空值的 RECOGNITION_WORKER_URL 不匹配启用识别的条件；有效 URL 才应用 API key 的必填和长度规则。之后进行 Nest 构建、交付阶段检查并提交修复 PR。
