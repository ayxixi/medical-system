---
description: "Use when writing or modifying TypeScript backend code that contains user-facing text, API response messages, validation messages, exception messages, Swagger descriptions, code comments, or other explanatory text. Enforces Chinese-first wording in this repository."
name: "Chinese User-Facing Text"
applyTo: "apps/server/src/**/*.ts"
---
# 用户可见文本语言规范

- 在 TypeScript 代码中新增或修改用户可见文本时，默认使用中文，包括异常提示、校验提示、接口返回说明、Swagger 描述与注释。
- 除非协议、库约定或用户明确要求英文，否则不要新增英文错误消息、英文注释或英文说明文本。
- 允许保留必要的英文内容：标识符、类名、函数名、环境变量名、路径、命令、HTTP 方法、状态码、第三方库 API 与行业通用缩写。
- 异常消息、日志中的业务说明文字、接口示例说明等应优先让中文读者直接理解，避免只写英文短语。
- 修改现有英文用户可见文本时，如不影响协议兼容性与测试假设，优先统一为中文。
- 若某处文本同时面向程序和人，优先保留机器稳定字段不变，仅将展示给人的说明部分改为中文。