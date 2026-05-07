# 极云主机管理系统

本仓库正在按 `DEVELOPMENT_PLAN.md` 重构为可运营的全栈主机销售与管理系统。当前已进入阶段 1：前端、后端、MySQL 与 worker 采用 Docker Compose 编排。

## 目录

- `frontend/`：React + Vite 前台、客户后台和总后台入口，Nginx 代理 `/api`。
- `backend/`：Node.js + Express API 服务，已接入 Prisma。
- `docker-compose.yml`：启动前端、后端、worker 和 MySQL。
- `docs/operation-plan/`：运营版阶段任务和验收标准。

## Docker 运行

首次启动前创建本地环境文件：

```bash
cp .env.example .env
```

启动服务：

```bash
docker compose up -d --build
```

访问：

- 前台：`http://localhost:8080`
- 后台入口：`http://localhost:8080/admin`
- 健康检查：`http://localhost:8080/api/health`

## 本地开发

前端：

```bash
cd frontend
npm install
npm run dev
```

后端：

```bash
cd backend
npm install
npm run dev
```
