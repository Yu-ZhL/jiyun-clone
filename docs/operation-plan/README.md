# 极云仿站运营版实施任务书

## 文档结构

本目录是后续开发执行依据，按层级拆分为多个文件，避免所有内容堆在一个 Markdown 里。

- [01-project-scope.md](01-project-scope.md)：项目定位、第一版范围、当前问题。
- [02-architecture.md](02-architecture.md)：技术选型、目录结构、Docker 服务架构。
- [03-database.md](03-database.md)：数据库模型和状态枚举。
- [04-api.md](04-api.md)：后端接口规划和统一返回格式。
- [05-frontend.md](05-frontend.md)：前台、客户后台、总后台页面规划。
- [06-business-flows.md](06-business-flows.md)：注册、购买、开通、续费、到期、代登录流程。
- [07-jobs-security.md](07-jobs-security.md)：定时任务和安全要求。
- [08-execution-phases.md](08-execution-phases.md)：分阶段执行任务和验收标准。
- [09-launch-checklist.md](09-launch-checklist.md)：最低上线验收清单和开发硬性规则。

## 执行原则

- 不再把业务数据写死在前端组件里。
- seed 数据只能放在后端 seed 脚本。
- 前端业务列表必须来自 API。
- 所有写操作必须经过后端接口。
- 所有需要身份的接口必须鉴权。
- 所有金额变动必须写流水。
- 所有后台关键操作必须写操作日志。
- 所有服务器密码必须加密保存。
- Docker 必须支持前端、后端、数据库和定时任务。

## 下一步立即执行

先执行 [08-execution-phases.md](08-execution-phases.md) 的阶段 1：

1. 重构目录，把现有前端迁移到 `frontend/`。
2. 新建 `backend/` Express 服务。
3. 接入 Prisma 和 MySQL。
4. 添加 `docker-compose.yml`。
5. 实现 `/api/health`。
6. 配置 Nginx 代理 `/api`。
7. 确认 `docker compose up -d --build` 可运行。
