---
description: "Use when creating or modifying frontend pages, React components, Vue components, web UI screens, forms, buttons, labels, placeholders, empty states, dialog text, page titles, onboarding copy, or other user-facing frontend wording. Enforces Chinese-first UI copy for this repository."
name: "Chinese Frontend Copy"
applyTo: "apps/**/*.{tsx,jsx,vue,html,svelte}"
---
# 前端页面文案语言规范

- 在前端页面、组件与交互界面中新增或修改用户可见文案时，默认使用中文。
- 适用范围包括但不限于：页面标题、导航名称、按钮文字、表单标签、占位符、提示语、空状态、弹窗说明、Toast、帮助文案与引导文案。
- 除非用户明确要求英文，或必须保留国际标准表达，否则不要新增英文页面文案。
- 允许保留必要的英文内容：路径、命令、环境变量、代码片段、第三方库名、品牌名、标准协议字段与通用技术缩写。
- 如果界面中必须出现英文术语，优先采用“中文说明 + 英文术语”的写法，确保中文用户可直接理解。
- 设计前端页面时，默认将中文作为主要展示语言；若后续需要国际化，再在不改变中文默认体验的前提下扩展。
- 修改现有页面文案时，优先保持交互含义稳定，不要因为翻译而改变按钮行为、字段含义或业务流程。
