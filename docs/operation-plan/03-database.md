# 03. 数据库模型

## admins

用途：后台管理员。

字段：

- `id`
- `username`
- `password_hash`
- `name`
- `role`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

初始 seed：

- 用户名：`admin`
- 密码：`123456`
- 角色：`super_admin`

## users

用途：客户账号。

字段：

- `id`
- `username`
- `email`
- `phone`
- `password_hash`
- `balance`
- `status`
- `register_ip`
- `last_login_at`
- `created_at`
- `updated_at`

状态：

- `active`
- `disabled`
- `pending`

## products

用途：服务器购买套餐。

字段：

- `id`
- `name`
- `type`
- `location`
- `cpu`
- `memory`
- `disk`
- `bandwidth`
- `defense`
- `price_monthly`
- `price_yearly`
- `stock`
- `status`
- `sort_order`
- `description`
- `created_at`
- `updated_at`

状态：

- `on_sale`
- `off_sale`

## orders

用途：客户购买、续费、充值订单。

字段：

- `id`
- `order_no`
- `user_id`
- `type`
- `product_id`
- `server_id`
- `cycle`
- `amount`
- `pay_method`
- `pay_status`
- `provision_status`
- `remark`
- `created_at`
- `paid_at`
- `cancelled_at`
- `opened_at`

订单类型：

- `new_server`
- `renew_server`
- `recharge`

支付状态：

- `unpaid`
- `paid`
- `cancelled`
- `refunded`

开通状态：

- `none`
- `pending`
- `opened`
- `failed`

## servers

用途：客户服务器实例。

字段：

- `id`
- `user_id`
- `product_id`
- `order_id`
- `name`
- `ip`
- `os`
- `login_user`
- `login_password_encrypted`
- `panel_url`
- `status`
- `opened_at`
- `expires_at`
- `suspended_at`
- `deleted_at`
- `created_at`
- `updated_at`

状态：

- `pending`
- `running`
- `expiring`
- `expired`
- `suspended`
- `deleted`

## wallet_transactions

用途：余额流水。

字段：

- `id`
- `user_id`
- `type`
- `amount`
- `balance_before`
- `balance_after`
- `related_order_id`
- `admin_id`
- `remark`
- `created_at`

类型：

- `recharge`
- `payment`
- `refund`
- `adjustment`

## renewals

用途：续费记录。

字段：

- `id`
- `server_id`
- `order_id`
- `old_expires_at`
- `new_expires_at`
- `created_at`

## tickets

用途：客户工单。

字段：

- `id`
- `user_id`
- `title`
- `category`
- `status`
- `created_at`
- `updated_at`
- `closed_at`

状态：

- `open`
- `processing`
- `replied`
- `closed`

## ticket_replies

用途：工单回复。

字段：

- `id`
- `ticket_id`
- `sender_type`
- `sender_id`
- `content`
- `created_at`

## notifications

用途：站内通知。

字段：

- `id`
- `user_id`
- `title`
- `content`
- `type`
- `read_at`
- `created_at`

## impersonation_tokens

用途：管理员代登录客户。

字段：

- `id`
- `admin_id`
- `user_id`
- `token_hash`
- `expires_at`
- `used_at`
- `created_at`

规则：

- token 只能使用一次。
- token 默认 5 分钟过期。
- 生成和使用都写操作日志。

## operation_logs

用途：后台审计。

字段：

- `id`
- `admin_id`
- `action`
- `target_type`
- `target_id`
- `detail`
- `ip`
- `user_agent`
- `created_at`

## system_settings

用途：站点配置。

字段：

- `id`
- `key`
- `value`
- `created_at`
- `updated_at`

配置项：

- `site_name`
- `support_phone`
- `support_email`
- `copyright`
- `registration_enabled`
- `expiry_remind_days`
- `overdue_suspend_days`
