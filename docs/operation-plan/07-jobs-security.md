# 07. 定时任务与安全要求

## 定时任务清单

### scanExpiringServers

频率：每天 09:00。

职责：

- 查找 7 天内到期且状态为 `running` 的服务器。
- 更新为 `expiring`。
- 每台服务器只生成一次同类型提醒。

### scanExpiredServers

频率：每小时。

职责：

- 查找 `expires_at < now` 的服务器。
- 状态更新为 `expired`。
- 超过保留天数后更新为 `suspended`。

### cancelExpiredOrders

频率：每小时。

职责：

- 查找超过 24 小时仍 `unpaid` 的订单。
- 更新为 `cancelled`。

### cleanupExpiredTokens

频率：每小时。

职责：

- 清理或标记过期的代登录 token。

## 安全要求

必须实现：

- bcrypt 密码哈希。
- HTTP-only Cookie。
- 客户接口校验客户身份。
- 管理员接口校验管理员身份。
- 客户不能通过改 ID 读取其他客户数据。
- 管理员关键操作写日志。
- 服务器密码加密保存。
- `.env` 不提交 Git。
- `.env.example` 提供变量模板。
- API 参数校验。
- 后端统一错误处理。

第一版可暂缓：

- 图形验证码。
- 邮箱验证。
- 两步验证。
- 完整 RBAC。
