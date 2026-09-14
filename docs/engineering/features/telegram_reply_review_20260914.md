# TG 回复审核绑定

- 在回复审核标题栏增加 `TelegramReviewBinding` 入口，沿用 http、Pinia 权限和 Element Plus 弹窗。
- 生成本人一次性 TG 链接，不在前端收集 Bot Token，不包含系统登录密码。
- 弹窗轮询绑定状态；关闭清除链接和定时器。链接到期不可点击，已绑定自动清除旧链接。
- 需要 operations.view + operations.review 才能创建绑定；已失去审核权限仍能解除本人绑定。
- 绑定链接仅允许 HTTPS t.me，失败保留当前状态，防重复点击。
- 测试：组件操作用例 4 项，加原审核界面/筛选回归共 8 项；vue-tsc + Vite 构建通过。
- 隔离 UI：`node tests/ui/telegram-review-preview.mjs`，只监听 127.0.0.1:5199，全部 API 为模拟，不可用其链接进行真实绑定。
- 桌面和 390x844 窄屏检查通过，弹窗宽 367px、无水平溢出；只读账号绑定按钮禁用。
- 依赖新版后端与迁移 0158、机器人配置及独立 Worker。此次未连接真实 Telegram、未部署后端。
