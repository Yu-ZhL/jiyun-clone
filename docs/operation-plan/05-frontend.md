# 05. 前端页面规划

## 前台页面

- `/`：官网首页。
- `/buy`：服务器购买。
- `/login`：客户登录。
- `/register`：客户注册。

要求：

- 前台所有中文使用香港繁体。
- 产品列表必须来自 `/api/products`。
- 购买必须要求登录；未登录跳转 `/login`。
- 注册成功后自动进入客户后台或登录页。

## 客户后台

- `/client`：总览。
- `/client/servers`：我的服务器。
- `/client/servers/:id`：服务器详情。
- `/client/orders`：订单记录。
- `/client/wallet`：余额和流水。
- `/client/tickets`：工单。
- `/client/notifications`：通知。

要求：

- 客户只能看自己的数据。
- 未登录不能进入客户后台。
- 服务器密码可展示，但必须来自后端解密结果。

## 后台

- `/admin`：管理员登录或后台首页。
- `/admin/dashboard`：控制台。
- `/admin/user/index.html`：用户管理。
- `/admin/product/index.html`：产品管理。
- `/admin/order/index.html`：订单管理。
- `/admin/server/index.html`：服务器管理。
- `/admin/ticket/index.html`：工单管理。
- `/admin/finance/index.html`：财务管理。
- `/admin/system/index.html`：系统设置。

要求：

- 后台中文使用简体中文。
- 未登录不能访问后台内页。
- 用户管理页必须支持“进入前台账号”。
- 所有关键操作必须写 operation log。

## 前端重构要求

- 从根目录 `src/` 迁移到 `frontend/src/`。
- 拆分页面、组件、API 客户端、状态管理。
- 删除作为业务源的前端默认数据。
- 保留少量 loading、empty、error 状态。
- 所有请求统一经过 `frontend/src/lib/api.js` 或同类模块。
