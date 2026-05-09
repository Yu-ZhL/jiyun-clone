# 极云主机管理系统 - Windows 本地搭建说明

## 一、环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Windows 系统 | Windows 10/11 64位 | 建议最新稳定版 |
| Docker Desktop | 最新版 | 用于运行 MySQL、前后端容器 |
| Node.js | 22.x | 本地开发调试时使用 |
| npm | 10.x | 随 Node.js 22.x 自带 |
| Git | 最新版 | 用于克隆代码仓库 |
| 内存 | 建议 8GB+ | Docker 运行时需要 |
| 磁盘 | 建议 10GB+ 空闲 | 存储 Docker 镜像和数据库数据 |

---

## 二、安装必要软件

### 2.1 安装 Docker Desktop

1. 访问 Docker 官方下载页面：`https://www.docker.com/products/docker-desktop/`
2. 下载 **Docker Desktop for Windows** 安装程序
3. 双击运行安装程序，按默认选项完成安装
4. 安装完成后**重启电脑**
5. 重启后 Docker Desktop 会自动启动（系统托盘出现鲸鱼图标）
6. 打开 PowerShell 或 CMD，验证安装：
   ```bash
   docker --version
   docker compose version
   ```
   **注意**：Windows 下的 Docker 会使用 WSL 2（Windows Subsystem for Linux）作为后端。如果首次安装，Docker Desktop 会提示你安装 WSL 2，请按提示完成安装。

### 2.2 安装 Node.js 22.x

1. 访问 Node.js 官网：`https://nodejs.org/`
2. 下载 **LTS 版本**（目前为 22.x），选择 **Windows Installer (.msi)** 64位
3. 双击运行安装程序，全部使用默认选项（确保勾选 "Add to PATH"）
4. 安装完成后，打开新的 PowerShell 窗口验证：
   ```bash
   node --version
   npm --version
   ```

### 2.3 安装 Git

1. 访问 Git 官网：`https://git-scm.com/download/win`
2. 下载 64位 Git for Windows 安装程序
3. 安装选项：全部使用默认值即可
4. 验证安装：
   ```bash
   git --version
   ```

---

## 三、克隆项目并配置

### 3.1 获取项目代码

打开 PowerShell，执行：

```bash
cd C:\共享文件夹\仿极云
```

如果项目代码已在本地，直接进入该目录。如需从远程仓库克隆，请执行对应的 `git clone` 命令。

### 3.2 配置环境变量

项目根目录已包含 `.env` 文件，内容如下：

```env
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

**安全建议**：
- 生产环境部署时，务必修改 `JWT_SECRET`、`COOKIE_SECRET`、`PASSWORD_ENCRYPTION_KEY` 三个密钥为随机字符串
- `ADMIN_DEFAULT_PASSWORD` 只在首次创建管理员时生效，建议首次登录后台后立即修改密码
- `PASSWORD_ENCRYPTION_KEY` 用于加密服务器密码，必须是 32 字节的密钥，**一旦有服务器数据后不要修改此值**，否则已加密的密码将无法解密

---

## 四、启动项目

### 4.1 使用 Docker Compose 启动（推荐）

在项目根目录下执行：

```bash
docker compose up -d --build
```

这将会：

1. **构建并启动 mysql 容器**：MySQL 8 数据库，自动创建 `jiyun` 数据库
2. **构建并启动 backend 容器**：
   - 基于 Node.js 22 Alpine 镜像
   - 安装 npm 依赖
   - 生成 Prisma Client
   - 执行 `prisma db push` 同步数据库结构
   - 执行 `seed.js` 填充默认数据
   - 启动 Express API 服务器（监听 3000 端口）
3. **构建并启动 worker 容器**：后台定时任务进程
4. **构建并启动 frontend 容器**：
   - 使用 Vite 构建 React 前端
   - Nginx 提供静态文件服务并反向代理 API 请求
   - 监听 8080 端口

**首次启动**需要拉取 Docker 镜像并安装依赖，可能需要 5-10 分钟（取决于网络速度）。

### 4.2 查看启动日志

```bash
# 查看所有容器的实时日志
docker compose logs -f

# 只查看后端日志
docker compose logs -f backend

# 只查看前端日志
docker compose logs -f frontend

# 只查看数据库日志
docker compose logs -f mysql
```

### 4.3 等待健康检查通过

后端容器配置了健康检查，会持续检测直到 API 服务就绪。当看到类似以下日志时，说明启动成功：

```
backend  | Server running on port 3000
```

然后访问 `http://localhost:8080`，能正常打开页面即表示启动成功。

---

## 五、验证部署

### 5.1 检查容器状态

```bash
docker compose ps
```

正常状态应显示四个服务均为 `Up` 或 `healthy`：
- `frontend` - Up
- `backend` - Up (healthy)
- `worker` - Up
- `mysql` - Up (healthy)

### 5.2 访问前端页面

在浏览器中打开：`http://localhost:8080`

- 首页（客户门户）：直接显示产品列表和首页内容
- 管理后台：访问首页后，需要登录。默认情况下，管理后台入口通过页面底部的管理入口或直接通过管理员登录访问

### 5.3 登录管理后台

1. 在浏览器访问 `http://localhost:8080`
2. 页面切换到管理后台登录界面
3. 输入默认管理员账号：
   - **用户名**：`admin`
   - **密码**：`123456`
4. 登录成功后进入管理后台仪表板

---

## 六、常用操作

### 6.1 停止项目

```bash
docker compose down
```

### 6.2 停止并删除数据卷（重置数据库）

```bash
docker compose down -v
```

**警告**：这会删除所有数据库数据！仅在需要完全重置时使用。

### 6.3 重新构建并启动

```bash
docker compose up -d --build
```

### 6.4 只重启某个服务

```bash
# 重启后端
docker compose restart backend

# 重启前端
docker compose restart frontend

# 重启数据库
docker compose restart mysql
```

### 6.5 进入容器调试

```bash
# 进入后端容器
docker compose exec backend sh

# 进入数据库容器
docker compose exec mysql bash

# 进入 MySQL 命令行
docker compose exec mysql mysql -u jiyun -p
# 输入密码: jiyun_password
```

### 6.6 查看数据库数据

```bash
# 进入 MySQL
docker compose exec mysql mysql -u root -p
# 输入密码: root_password

# 然后执行：
USE jiyun;
SHOW TABLES;
SELECT * FROM Admin;
SELECT * FROM User;
SELECT * FROM SystemSetting;
```

---

## 七、本地开发模式（不使用 Docker）

如果需要在本地直接运行前后端进行开发调试：

### 7.1 本地运行数据库

可以只使用 Docker 运行 MySQL：

```bash
docker compose up -d mysql
```

或者手动安装 MySQL 8，创建数据库 `jiyun`，用户名密码均为 `jiyun` / `jiyun_password`。

如果使用本地 MySQL，需要修改 `.env` 中的 `DATABASE_URL`：

```env
DATABASE_URL=mysql://jiyun:jiyun_password@localhost:3306/jiyun
```

### 7.2 本地运行后端

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
npm run dev
```

后端将在 `http://localhost:3000` 启动，支持热重载（文件修改后自动重启）。

### 7.3 本地运行前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器将在 `http://localhost:5173` 启动。

**注意**：本地开发模式下，前端的 API 请求需要代理到后端。需要在 `frontend/` 目录下创建 `vite.config.js` 来配置代理。Docker 部署时由 Nginx 处理代理，本地开发需要 Vite 代理支持。

---

## 八、项目架构说明

```
浏览器访问 localhost:8080
        │
        ▼
   Nginx (:80) ─────────────┐
   (frontend 容器)           │
        │                    │
   /api/* 代理              静态文件 (React SPA)
        │                    │
        ▼                    ▼
   Express API (:3000)    index.html + JS/CSS
   (backend 容器)
        │
        ▼
   MySQL 8 (:3306)
   (mysql 容器)
        │
        ▼
   Worker (定时任务)
   (worker 容器)
```

### 各容器职责

| 容器 | 端口 | 职责 |
|------|------|------|
| frontend | 8080→80 | Nginx 静态文件服务 + API 反向代理 |
| backend | 3000 | Express.js REST API，处理全部业务逻辑 |
| mysql | 3306 | MySQL 8 数据存储 |
| worker | - | 定时任务（到期提醒、过期暂停、订单取消等） |

---

## 九、定时任务说明

Worker 进程使用 `node-cron` 执行以下定时任务：

| 任务 | 频率 | 说明 |
|------|------|------|
| 到期扫描 | 每天 | 扫描即将到期的服务器，发送到期提醒通知 |
| 过期暂停 | 每天 | 暂停已过期超过 N 天的服务器（默认3天） |
| 订单取消 | 每小时 | 取消超过 N 小时未支付的订单（默认24小时） |
| 令牌清理 | 每天 | 清理过期的模拟登录令牌 |

---

## 十、故障排查

### 10.1 端口冲突

**现象**：启动失败，提示端口被占用。

**解决**：
```bash
# 查看 8080 端口占用
netstat -ano | findstr :8080

# 查看 3000 端口占用
netstat -ano | findstr :3000

# 查看 3306 端口占用
netstat -ano | findstr :3306
```

如果端口被其他程序占用，修改 `docker-compose.yml` 中的端口映射：
```yaml
frontend:
  ports:
    - "8088:80"   # 改用 8088 端口

backend:
  ports:
    - "3008:3000"  # 如需直接访问后端
```

### 10.2 Docker 启动失败

**现象**：`docker compose up` 报错。

**排查步骤**：
1. 确认 Docker Desktop 正在运行（系统托盘鲸鱼图标）
2. 重启 Docker Desktop
3. 清理旧容器和镜像：
   ```bash
   docker compose down -v
   docker system prune -af
   docker compose up -d --build
   ```

### 10.3 数据库连接失败

**现象**：后端日志显示无法连接数据库。

**排查**：
1. 确认 mysql 容器健康：`docker compose ps`
2. 查看 mysql 日志：`docker compose logs mysql`
3. 检查 `.env` 中的 `DATABASE_URL` 是否正确
4. 注意：Docker 环境下数据库主机名是 `mysql`（容器名），不是 `localhost`

### 10.4 前端页面空白

**现象**：浏览器访问 localhost:8080 显示空白页。

**排查**：
1. 检查前端构建是否成功：`docker compose logs frontend`
2. 检查 API 是否正常：访问 `http://localhost:8080/api/health`
3. 打开浏览器开发者工具 (F12)，查看 Console 和 Network 标签中的错误

### 10.5 API 返回 500 错误

**现象**：API 请求返回 500 错误。

**排查**：
1. 查看后端日志：`docker compose logs backend --tail 50`
2. 确认数据库已正确初始化（Prisma db push + seed 已完成）
3. 检查环境变量中的密钥配置是否正确

---

## 十一、快速命令参考

```bash
# 启动所有服务
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并清空数据库
docker compose down -v

# 重启所有服务
docker compose restart

# 查看运行状态
docker compose ps

# 查看实时日志（所有服务）
docker compose logs -f

# 查看实时日志（仅后端）
docker compose logs -f backend

# 进入后端容器
docker compose exec backend sh

# 进入数据库
docker compose exec mysql mysql -u jiyun -pjiyun_password jiyun

# 重新构建后端
docker compose up -d --build backend

# 查看 Docker 资源使用
docker stats
```

---

## 十二、生产环境注意事项

1. **修改所有默认密钥**：`JWT_SECRET`、`COOKIE_SECRET`、`PASSWORD_ENCRYPTION_KEY` 必须改为随机强密码
2. **修改默认管理员密码**：首次登录后立即修改
3. **使用 HTTPS**：生产环境应配置 SSL/TLS 证书（可使用 Nginx 反向代理或云服务商的证书服务）
4. **数据库备份**：定期备份 MySQL 数据卷 `mysql_data`
5. **日志管理**：生产环境建议接入日志收集系统
6. **资源限制**：在 `docker-compose.yml` 中为各容器设置 CPU/内存限制
