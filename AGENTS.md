# AGENTS.md

## 项目结构

- 产品：服务器销售与运营系统，包含官网、客户中心、管理后台、API、MySQL、Prisma 和定时任务。
- 前端：`frontend/`，React + Vite。`frontend/src/main.jsx` 应只做应用装配，页面组件放在 `frontend/src/components/`，公共工具放在 `frontend/src/utils.js`。
- 后端：`backend/`，Express 入口为 `backend/src/app.js`，Prisma 模型为 `backend/prisma/schema.prisma`。
- 样式：主要在 `frontend/src/styles.css`。新增首页或后台样式时使用明确命名空间，避免污染全局按钮、表格和布局类。

## 产品原则

- 这是运营产品，不是静态展示页。列表、仪表盘、按钮和状态必须连接真实后端数据或明确可用的本地状态。
- 客户与后台流程要闭环：订单、服务器、余额、通知、工单、操作日志之间的数据关系必须一致。
- 公开前端不得展示 seed、管理员账号、内部实现说明或调试文案。
- 状态、类型和操作文案面向用户时使用中文业务标签，不直接暴露 `new_server`、`unpaid`、`pending` 等内部值。

## 前端要求

- 前端要符合服务器/云基础设施销售场景，素材、轮播、产品卡、评价、平台能力区要像真实运营站。
- 数据密集页面优先可读和可操作：状态标签、身份信息、金额、时间、关联对象和主要操作要清晰。
- 前端交互修改后要验证关键路径：登录/注册、购买、订单详情、通知、服务器、工单、后台登录、后台订单/用户/服务器管理。
- 避免把复杂页面继续堆进单个文件；拆分时必须让入口真实导入新模块，不能留下死文件或临时切割脚本。

## 常用命令

- 启动全栈：`docker compose -p jiyun up -d --build`
- 前端构建：`cd frontend && npm run build`
- Prisma 生成：`cd backend && npm run prisma:generate`
- 验收脚本：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/acceptance.ps1`

## 交付与 Git

- 不要重置或回退用户/其他代理的未提交改动；先读 diff，再在自己的范围内修改。
- 不提交 `dist/`、截图、临时验证目录、环境文件或测试产物，除非用户明确要求。
- 后端、模型或核心业务流程变更后，优先跑 Docker 验收；纯文档变更不需要跑构建。
- 提交前说明验证结果；不能验证时说明原因和风险。
