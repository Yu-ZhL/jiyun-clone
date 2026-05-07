# 极云仿站缺口评估与开发计划

## 当前状态结论

当前项目是一个前端演示版，不是可上线业务系统。它已经具备官网、服务器购买页、总后台、客户后台的页面外观和基础交互，但核心业务数据都写在 `src/main.jsx` 的默认数据对象中，并通过浏览器 `localStorage` 保存。

这意味着刷新和本机演示可以跑通，但换浏览器、换设备、清缓存、多人同时使用、真实登录注册、订单审核、服务器到期处理等场景都不成立。

## 已完成的演示能力

- 前台官网：香港繁体文案，包含首页、产品展示、购买入口。
- 服务器购买页：可选择产品、月付/年付，提交后生成本地订单和待开通服务器。
- 客户后台：展示当前客户的服务器、订单、余额、工单。
- 总后台：简体中文后台，包含控制台、服务器管理、产品管理、订单管理、用户管理、系统设置。
- 管理员登录演示：账号 `admin`，密码 `123456`。
- 用户管理演示：点击“进入前台”可切换到指定客户后台。
- Docker：已有 `Dockerfile` 和 `nginx.conf`，可构建静态前端容器。
- GitHub：代码已推送到 `https://github.com/Yu-ZhL/jiyun-clone`。

## 主要缺失

### 1. 后端服务缺失

当前没有后端应用，所有业务逻辑都在浏览器中执行。

需要补充：

- 后端框架服务，例如 Node.js/NestJS、Express、Laravel 或 Spring Boot。
- 数据库连接。
- 统一接口返回格式。
- 参数校验、错误处理、日志记录。
- 管理员后台接口和客户前台接口隔离。

说明：用户要求“不需要接入 API”应理解为不接入云厂商或支付网关等第三方 API，但系统自身仍然需要后端接口，否则无法实现真实登录、注册、订单、到期任务和数据管理。

### 2. 数据库缺失

当前用户、产品、服务器、订单、工单都写死在前端。

需要设计数据库表：

- `admins`：管理员账号、密码哈希、角色、状态。
- `users`：客户账号、邮箱、手机号、余额、状态、注册时间。
- `products`：服务器套餐、地区、CPU、内存、硬盘、带宽、防护、价格、上下架状态。
- `servers`：服务器实例、所属用户、所属产品、IP、系统、账号、密码密文、状态、到期时间。
- `orders`：订单号、用户、产品、周期、金额、支付状态、开通状态。
- `payments`：充值/支付记录，可先做手动入账。
- `tickets`：工单、回复、状态。
- `system_settings`：站点名称、客服信息、版权、语言配置。
- `operation_logs`：管理员操作日志。

建议先用 MySQL 或 PostgreSQL。Docker 开发环境可以用 MySQL，后续上线也容易迁移。

### 3. 登录注册缺失

当前管理员登录只是前端判断 `admin/123456`，客户后台没有真正登录，注册也没有实现。

需要补充：

- 客户注册页：用户名/邮箱/手机号、密码、确认密码。
- 客户登录页：账号密码登录。
- 管理员登录页：后台独立登录。
- 密码哈希存储，不能明文保存。
- 登录态使用 Session 或 JWT。
- 退出登录。
- 登录失败限制。
- 注册开关、默认用户状态配置。
- 找回密码可放到第二阶段。

### 4. 权限系统缺失

当前只区分“管理员演示状态”和“当前客户 ID”，没有真实权限。

需要补充：

- 管理员角色：超级管理员、客服、财务、运维。
- 后台菜单权限。
- 后台接口权限。
- 客户只能访问自己的订单、服务器、工单。
- 管理员“进入前台账号”需要生成一次性代登录令牌，并记录操作日志。

### 5. 订单和购买流程缺失

当前购买后直接生成“已支付”订单，没有支付状态、审核、开通流程。

建议第一版做成手动支付/手动确认：

- 客户提交订单。
- 订单状态：待支付、已支付、待开通、已开通、已取消、已退款。
- 后台手动标记已支付。
- 后台手动录入服务器信息并绑定订单。
- 开通后客户后台可看到服务器资料。
- 续费订单、升级订单、取消订单。
- 余额支付可作为第一版支付方式。

### 6. 服务器生命周期缺失

当前服务器只有一个到期日期字段，没有自动状态变化。

需要补充：

- 服务器状态：待开通、运行中、即将到期、已到期、已暂停、已删除。
- 到期前提醒：例如 7 天、3 天、1 天。
- 到期自动暂停。
- 超期保留期，例如 7 天。
- 超期删除或标记回收。
- 续费后自动延长到期时间。
- 后台可手动暂停、恢复、删除、延长到期时间。

### 7. 定时任务缺失

当前没有任何定时任务。

需要补充：

- 每日扫描即将到期服务器。
- 每小时扫描已到期服务器并更新状态。
- 自动生成提醒通知。
- 自动取消长时间未支付订单。
- 定期清理过期代登录令牌。
- 定期备份数据库。

如果使用 Node.js，可先用 `node-cron`；如果后续要更稳定，可以拆成独立 worker 容器。

### 8. 通知系统缺失

当前没有站内信、邮件、短信。

第一版建议先做站内通知：

- 订单创建通知。
- 订单支付确认通知。
- 服务器开通通知。
- 到期提醒通知。
- 工单回复通知。

邮件和短信可以第二阶段再接。

### 9. 工单系统缺失

当前工单只是静态列表。

需要补充：

- 客户提交工单。
- 客户回复工单。
- 管理员回复工单。
- 工单状态：待处理、处理中、已回复、已关闭。
- 工单分类：售前、财务、技术、故障。
- 附件上传可第二阶段做。

### 10. 财务和余额缺失

当前余额是写死字段。

需要补充：

- 后台手动充值/扣款。
- 客户余额流水。
- 订单扣款记录。
- 退款记录。
- 财务操作日志。
- 对账列表。

### 11. 安全能力缺失

当前版本不具备真实安全性。

需要补充：

- 密码哈希，例如 bcrypt/argon2。
- 后台验证码或登录失败限制。
- CSRF 或 JWT 安全策略。
- XSS 防护。
- 输入参数校验。
- 敏感字段加密，例如服务器密码。
- 管理员操作日志。
- Docker 环境变量管理，不能把密钥写进代码。

### 12. 部署架构缺失

当前 Docker 只部署静态前端。

需要改成多服务：

- `frontend`：React 构建产物，由 Nginx 托管。
- `backend`：业务 API 服务。
- `mysql`：数据库。
- `redis`：缓存、会话、队列，可第二阶段加入。
- `worker`：定时任务和异步任务，可第二阶段拆出。

需要补充：

- `docker-compose.yml`
- `.env.example`
- 数据库初始化脚本。
- 生产环境构建说明。
- 数据备份说明。

## 推荐技术方案

### 方案 A：Node.js 全栈，开发速度快

- 前端：React + Vite
- 后端：NestJS 或 Express
- 数据库：MySQL
- ORM：Prisma
- 定时任务：node-cron，后续可拆 worker
- 部署：Docker Compose

优点：和当前前端项目衔接快，适合快速做出可用版本。

### 方案 B：Laravel 后台系统，管理功能成熟

- 前端：React 或 Blade
- 后端：Laravel
- 数据库：MySQL
- 队列/定时：Laravel Scheduler + Queue
- 部署：Docker Compose

优点：后台、权限、队列、定时任务体系成熟。缺点是当前项目需要更大改造。

### 建议选择

建议采用方案 A：`React + Express/NestJS + Prisma + MySQL + Docker Compose`。原因是当前已经是 React 项目，继续扩展最快。

## 分阶段开发计划

### 第一阶段：补齐真实数据和基础账号

目标：去掉前端写死数据，让系统变成真实可登录、可注册、可保存数据的版本。

任务：

- 新建后端服务。
- 新建 MySQL 数据库。
- 接入 Prisma 或其他 ORM。
- 建立用户、管理员、产品、订单、服务器基础表。
- 实现客户注册、客户登录、客户退出。
- 实现管理员登录、管理员退出。
- 前端移除核心写死数据，改为调用后端接口。
- Docker Compose 同时启动前端、后端、数据库。

验收：

- 新客户可以注册并登录。
- 管理员可以登录后台。
- 刷新浏览器后数据不丢失。
- 换浏览器登录后仍能看到数据库中的数据。

### 第二阶段：补齐购买和后台录入流程

目标：实现可用的服务器购买和人工开通流程。

任务：

- 后台产品管理：新增、编辑、上下架、删除。
- 前台购买页读取真实产品。
- 客户创建订单。
- 后台查看订单。
- 后台手动标记支付。
- 后台手动录入服务器信息并绑定用户。
- 客户后台查看已开通服务器。
- 用户管理支持管理员代登录客户。

验收：

- 后台新增产品后，前台购买页立即可见。
- 客户购买后，后台订单列表出现新订单。
- 管理员录入服务器后，客户后台能看到服务器信息。
- 管理员从用户列表进入前台客户账号，并记录操作日志。

### 第三阶段：到期、续费和定时任务

目标：让服务器生命周期自动运转。

任务：

- 订单周期计算。
- 服务器到期时间计算。
- 续费订单。
- 续费后延长服务器到期时间。
- 定时任务扫描即将到期服务器。
- 定时任务扫描已到期服务器。
- 自动更新服务器状态。
- 生成站内通知。
- 后台可手动暂停、恢复、延长、删除服务器。

验收：

- 服务器到期前自动生成提醒。
- 到期后自动变为已到期或已暂停。
- 续费后状态恢复并延长到期时间。
- 定时任务日志可在后台或日志文件中查看。

### 第四阶段：工单、财务和通知

目标：让客户服务和财务流程基本可用。

任务：

- 客户提交工单。
- 管理员回复工单。
- 工单状态流转。
- 后台手动充值。
- 余额流水。
- 余额支付订单。
- 站内通知中心。
- 邮件通知预留接口。

验收：

- 客户能提交和回复工单。
- 管理员能处理工单。
- 后台充值后客户余额变化。
- 订单扣款有流水记录。

### 第五阶段：安全、审计和上线准备

目标：达到可部署给真实用户试运行的最低标准。

任务：

- 密码哈希。
- 接口权限校验。
- 管理员操作日志。
- 登录失败限制。
- 敏感信息加密。
- `.env.example` 和生产环境变量。
- 数据库备份脚本。
- Nginx 反向代理配置。
- 基础错误日志。
- README 部署文档更新。

验收：

- 普通客户无法访问其他客户数据。
- 未登录无法访问后台和客户中心。
- 管理员关键操作都有日志。
- 生产环境可以通过 Docker Compose 一键启动。

## 数据库表初稿

```text
admins
- id
- username
- password_hash
- role
- status
- created_at
- updated_at

users
- id
- username
- email
- phone
- password_hash
- balance
- status
- created_at
- updated_at

products
- id
- name
- type
- location
- cpu
- memory
- disk
- bandwidth
- defense
- price_monthly
- price_yearly
- status
- sort_order
- created_at
- updated_at

orders
- id
- order_no
- user_id
- product_id
- cycle
- amount
- pay_status
- provision_status
- created_at
- paid_at
- opened_at

servers
- id
- user_id
- product_id
- order_id
- name
- ip
- os
- login_user
- login_password_encrypted
- status
- expires_at
- created_at
- updated_at

renewals
- id
- server_id
- order_id
- old_expires_at
- new_expires_at
- created_at

tickets
- id
- user_id
- title
- category
- status
- created_at
- updated_at

ticket_replies
- id
- ticket_id
- sender_type
- sender_id
- content
- created_at

notifications
- id
- user_id
- title
- content
- read_at
- created_at

operation_logs
- id
- admin_id
- action
- target_type
- target_id
- ip
- user_agent
- created_at
```

## 路由规划

### 前台

- `/`：官网首页
- `/buy`：服务器购买
- `/login`：客户登录
- `/register`：客户注册
- `/client`：客户后台首页
- `/client/servers`：我的服务器
- `/client/orders`：订单记录
- `/client/tickets`：工单
- `/client/billing`：财务中心

### 后台

- `/admin`：管理员登录或后台首页
- `/admin/dashboard`：控制台
- `/admin/user/index.html`：用户管理
- `/admin/product/index.html`：产品管理
- `/admin/order/index.html`：订单管理
- `/admin/server/index.html`：服务器管理
- `/admin/ticket/index.html`：工单管理
- `/admin/finance/index.html`：财务管理
- `/admin/system/index.html`：系统设置

## 接口规划

### 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`

### 产品和购买

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/client/orders`
- `GET /api/client/servers`

### 后台管理

- `GET /api/admin/users`
- `POST /api/admin/users/:id/impersonate`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `GET /api/admin/orders`
- `PUT /api/admin/orders/:id/pay`
- `GET /api/admin/servers`
- `POST /api/admin/servers`
- `PUT /api/admin/servers/:id`

### 定时任务内部接口或命令

- `scanExpiringServers`
- `scanExpiredServers`
- `cancelExpiredOrders`
- `cleanupExpiredTokens`

## Docker 改造计划

目标结构：

```text
docker-compose.yml
frontend/
backend/
mysql/
```

服务：

```text
frontend: Nginx 托管 React 静态文件
backend: Node.js API 服务
mysql: 数据库
redis: 缓存和队列，第二阶段可加入
worker: 定时任务，第三阶段可拆出
```

第一版 Compose 至少包含：

- `frontend`
- `backend`
- `mysql`

## 优先级排序

### 必须优先做

1. 后端服务和数据库。
2. 客户注册/登录。
3. 管理员登录。
4. 产品表和后台产品管理。
5. 订单表和购买流程。
6. 服务器表和后台手动录入。
7. 客户后台读取真实服务器。

### 第二优先级

1. 到期时间和续费。
2. 定时任务。
3. 站内通知。
4. 工单系统。
5. 余额和财务流水。

### 第三优先级

1. 邮件通知。
2. 短信通知。
3. 多管理员角色权限。
4. 数据备份和恢复。
5. 更细的审计日志。

## 预计工作量

如果以当前项目为基础继续开发：

- 第一阶段：1 到 2 天。
- 第二阶段：1 到 2 天。
- 第三阶段：1 天。
- 第四阶段：1 到 2 天。
- 第五阶段：1 天。

合计约 5 到 8 天可以做出一个不接第三方 API、但具备真实登录注册、后台管理、服务器购买、手动开通、到期任务的基础版本。

## 下一步建议

建议下一步直接进入第一阶段：把项目从纯前端演示版改造成 Docker Compose 全栈版本，新增 `backend` 和 `mysql`，先完成真实注册、登录、产品、订单、服务器录入这条主流程。
