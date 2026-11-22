# 设计与拆分

状态：已记录

通过 `React.lazy(() => import(...))` 拆分登录、注册、首页、成员、就诊列表、详情与 AppLayout；用单个 `Suspense` 包裹 Routes 提供页面加载提示。测试使用 MemoryRouter 验证登录页面动态加载和未认证路由重定向，不引入新的运行时依赖。
