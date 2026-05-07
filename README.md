# 极云主机管理系统

极云运营版主机销售与管理系统，包含前台官网、客户后台、管理员后台、Express API、MySQL、Prisma 和 worker 定时任务。

## 目录

- `frontend/`：React + Vite 前台、购买页、客户后台、总后台入口，Nginx 代理 `/api`。
- `backend/`：Node.js + Express API、Prisma schema、seed、worker。
- `docker-compose.yml`：启动 `frontend`、`backend`、`worker`、`mysql`。
- `scripts/acceptance.ps1`：最小端到端验收脚本。
- `docs/operation-plan/`：运营版阶段任务和验收依据。

## 默认账号

- 管理员：`admin`
- 管理员密码：`123456`
- 演示客户：`demo`
- 演示客户密码：`123456`

默认账号由 `backend/prisma/seed.js` 创建，密码以 bcrypt 哈希入库。

## 环境初始化

```powershell
Copy-Item .env.example .env
```

关键环境变量：

- `DATABASE_URL`：MySQL 连接串，Docker 默认使用 `mysql://jiyun:jiyun_password@mysql:3306/jiyun`。
- `JWT_SECRET`：生产环境必须改成随机强密钥。
- `COOKIE_SECRET`：生产环境必须改成随机强密钥。
- `PASSWORD_ENCRYPTION_KEY`：服务器登录密码加密密钥，生产环境必须固定保存且不得泄露。

## Docker 启动

```powershell
docker compose -p jiyun up -d --build
```

访问：

- 前台：`http://localhost:8080`
- 后台：`http://localhost:8080/admin`
- 健康检查：`http://localhost:8080/api/health`

> 仓库目录包含中文路径时，建议显式加 `-p jiyun`，避免 Compose 项目名为空。

## 数据库初始化

`backend` 容器启动时会执行：

```bash
prisma db push
node prisma/seed.js
```

这会同步表结构并创建默认管理员、演示客户、初始产品和系统配置。`worker` 等待 `backend` healthcheck 通过后启动，不单独执行建表。

## 本地开发

前端：

```powershell
cd frontend
npm install
npm run dev
```

后端：

```powershell
cd backend
npm install
npm run dev
```

本地后端开发需要可访问的 MySQL，并正确设置 `DATABASE_URL`。

## 验收

先启动 Docker：

```powershell
docker compose -p jiyun up -d --build
```

运行最小验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/acceptance.ps1
```

脚本覆盖：

- 首页和后台入口可访问。
- `/api/health` 数据库检查通过。
- 客户注册、登录态恢复。
- 管理员 `admin/123456` 登录。
- 后台新增产品后前台可见。
- 客户创建订单、后台充值、余额支付并写流水。
- 后台开通服务器，客户后台可见。
- 服务器密码数据库加密保存，接口按权限解密展示。
- 客户续费并延长到期时间。
- 客户提交工单，管理员回复。
- 管理员代登录 token 一次性有效。
- worker 任务可通过后台任务接口触发。
- 关键后台操作写入操作日志。

## 常用运维命令

```powershell
docker compose -p jiyun ps
docker compose -p jiyun logs -f backend
docker compose -p jiyun logs -f worker
docker compose -p jiyun restart backend worker
docker compose -p jiyun down
```

进入数据库：

```powershell
docker exec -it jiyun-mysql-1 mysql -ujiyun -pjiyun_password jiyun
```

## 备份建议

定期备份 MySQL：

```powershell
docker exec jiyun-mysql-1 mysqldump -uroot -proot_password jiyun > backup-jiyun.sql
```

恢复前先确认目标环境和密钥：

```powershell
Get-Content .env
```

`PASSWORD_ENCRYPTION_KEY` 必须与备份数据匹配，否则已保存的服务器登录密码无法解密。

## 安全注意

- `.env` 已加入 `.gitignore`，不得提交。
- 生产环境必须替换 `JWT_SECRET`、`COOKIE_SECRET`、`PASSWORD_ENCRYPTION_KEY`。
- 所有客户和管理员密码使用 bcrypt。
- 客户接口和后台接口分别校验 HTTP-only Cookie。
- 余额变化写入 `WalletTransaction`。
- 后台充值、确认支付、开通服务器、代登录、工单回复等关键操作写入 `OperationLog`。
