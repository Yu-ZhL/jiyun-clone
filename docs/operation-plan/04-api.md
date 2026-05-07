# 04. 后端接口规划

## 统一返回格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 40001,
  "message": "参数错误",
  "data": null
}
```

## 客户认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 管理员认证

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

## 前台产品和购买

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `POST /api/orders/:id/pay-with-balance`

## 客户后台

- `GET /api/client/summary`
- `GET /api/client/orders`
- `GET /api/client/servers`
- `GET /api/client/servers/:id`
- `POST /api/client/servers/:id/renew`
- `GET /api/client/wallet/transactions`
- `GET /api/client/notifications`
- `POST /api/client/notifications/:id/read`

## 客户工单

- `GET /api/client/tickets`
- `POST /api/client/tickets`
- `GET /api/client/tickets/:id`
- `POST /api/client/tickets/:id/replies`
- `POST /api/client/tickets/:id/close`

## 后台控制台

- `GET /api/admin/dashboard/summary`
- `GET /api/admin/dashboard/recent-orders`
- `GET /api/admin/dashboard/expiring-servers`

## 后台用户管理

- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PUT /api/admin/users/:id`
- `POST /api/admin/users/:id/disable`
- `POST /api/admin/users/:id/enable`
- `POST /api/admin/users/:id/adjust-balance`
- `POST /api/admin/users/:id/impersonate`

## 后台产品管理

- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/:id`
- `PUT /api/admin/products/:id`
- `POST /api/admin/products/:id/on-sale`
- `POST /api/admin/products/:id/off-sale`
- `DELETE /api/admin/products/:id`

## 后台订单管理

- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders/:id/mark-paid`
- `POST /api/admin/orders/:id/cancel`
- `POST /api/admin/orders/:id/refund`

## 后台服务器管理

- `GET /api/admin/servers`
- `POST /api/admin/servers`
- `GET /api/admin/servers/:id`
- `PUT /api/admin/servers/:id`
- `POST /api/admin/servers/:id/open`
- `POST /api/admin/servers/:id/suspend`
- `POST /api/admin/servers/:id/resume`
- `POST /api/admin/servers/:id/extend`
- `POST /api/admin/servers/:id/delete`

## 后台工单管理

- `GET /api/admin/tickets`
- `GET /api/admin/tickets/:id`
- `POST /api/admin/tickets/:id/replies`
- `POST /api/admin/tickets/:id/close`

## 后台系统设置

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/operation-logs`
