# 设计与拆分

状态：已记录

- LocalStorageService 用临时目录验证保存、读取、删除和路径穿越/符号链接边界。
- S3StorageService mock AWS SDK client/commands，验证 payload、配置、缓存、缺失对象和失败行为。
- RecognitionService mock global fetch，验证调用参数、响应映射、限流/超时/网络/无效响应及通用日志不含正文。
- AuditService/AuditInterceptor 验证仅写入白名单元数据且失败请求会重新抛出原错误。
- ExportService 验证查询选择范围、输出版本/时间、账号缺失及敏感字段排除。
- 校验错误转换、HTTP 异常归一化、存储键生成和日志元数据边界增加纯单元测试。
- 同步计划、六阶段记录，运行完整后端测试和构建。
