# 实现记录

状态：已记录

已修正 `RECOGNITION_WORKER_URL` 条件 schema：只有合法且实际配置的 http/https 地址才触发 `RECOGNITION_API_KEY` 必填校验。worker 地址/API key 都空时保留未启用状态。
