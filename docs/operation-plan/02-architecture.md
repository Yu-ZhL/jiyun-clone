# 02. 技术架构

## 技术选型

### 前端

- React + Vite。
- 保留当前页面视觉基础，逐步拆组件。
- 前台语言：香港繁体。
- 后台语言：简体中文。

### 后端

采用 Node.js + Express。

选择理由：

- 当前项目已经是 Node/Vite 生态。
- Express 启动成本低，适合快速落地。
- 后续如果复杂度上升，可以迁移到 NestJS。

### 数据库

采用 MySQL 8。

### ORM

采用 Prisma。

选择理由：

- 迁移管理清晰。
- Schema 可读性高。
- JavaScript 项目接入快。

### 认证

第一版采用 JWT + HTTP-only Cookie。

规则：

- 客户和管理员使用不同登录接口。
- 客户 Token 和管理员 Token 必须区分用途。
- 密码使用 bcrypt 哈希。
- 后端所有业务接口必须校验身份。

### 定时任务

第一版使用独立 worker 进程，基于 `node-cron` 执行。

Docker 中拆分：

- `backend`：HTTP API。
- `worker`：定时任务。

两者共用同一份后端代码和数据库。

## 目标目录结构

```text
.
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── worker.js
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── jobs/
│   │   └── utils/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
├── DEVELOPMENT_PLAN.md
└── docs/
    └── operation-plan/
```

当前根目录下的 React 代码后续要迁移到 `frontend/`，不要继续把所有业务堆在 `src/main.jsx`。

## Docker Compose 目标

必须支持：

```bash
docker compose up -d --build
```

启动后：

- 前台访问：`http://localhost:8080`
- 后台访问：`http://localhost:8080/admin`
- 后端内部：`backend:3000`
- MySQL 内部：`mysql:3306`

服务规划：

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    env_file:
      - .env
    depends_on:
      - mysql

  worker:
    build: ./backend
    command: npm run worker
    env_file:
      - .env
    depends_on:
      - mysql

  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: jiyun
      MYSQL_USER: jiyun
      MYSQL_PASSWORD: jiyun_password
      MYSQL_ROOT_PASSWORD: root_password
    volumes:
      - mysql_data:/var/lib/mysql
```

## 环境变量

`.env.example` 必须包含：

```text
NODE_ENV=development
APP_URL=http://localhost:8080
API_PORT=3000
DATABASE_URL=mysql://jiyun:jiyun_password@mysql:3306/jiyun
JWT_SECRET=change_me
COOKIE_SECRET=change_me
PASSWORD_ENCRYPTION_KEY=change_me_32_bytes
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=123456
EXPIRY_REMIND_DAYS=7
OVERDUE_SUSPEND_DAYS=3
UNPAID_ORDER_CANCEL_HOURS=24
```
