# 账号数据子路由

社媒账号数据、外部账号监听和 Shopify 店铺监听分别使用 `/account-data/social`、`/account-data/external`、`/account-data/shopify`。页签读取路由名称，切换使用 push，支持刷新、直接链接和前进后退。

原 `/account-data` 默认重定向社媒数据，旧 `?view=shopify` 及 `?view=external` 重定向对应页面，保留其他查询参数和 hash。三个子页分别挂载，访问外部监听或 Shopify 不再同时初始化社媒账号数据的请求和事件监听。

保留账号查看权限；外部监听额外要求运营查看权限，Shopify 检查业务范围。侧栏账号数据保持高亮。筛选缓存和详情弹窗状态不纳入本次 URL 改造。

验证直接访问、刷新、历史导航、旧链接和权限边界。不修改后端和脚本，不恢复已暂停的发版。
