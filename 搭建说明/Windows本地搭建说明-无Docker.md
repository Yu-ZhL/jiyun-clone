# 极云主机管理系统 - Windows 本地搭建说明（无需 Docker）

本指南适用于不想使用 Docker，直接在 Windows 上运行 MySQL、Node.js 后端和前端开发服务器的场景。

---

## 一、环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Windows 系统 | Windows 10/11 64位 | 建议最新稳定版 |
| Node.js | 22.x | 后端和前端运行环境 |
| npm | 10.x | 随 Node.js 22.x 自带 |
| MySQL | 8.0+ | 数据库，推荐使用 MySQL Community Server |
| Git | 最新版 | 用于克隆代码仓库（可选） |
| 内存 | 建议 8GB+ | |
| 磁盘 | 建议 5GB+ 空闲 | |

---

## 二、安装 MySQL 8.0

### 2.1 下载安装 MySQL

1. 访问 MySQL 官网下载页面：`https://dev.mysql.com/downloads/mysql/`
2. 选择 **Windows (x86, 64-bit), MSI Installer** （约 300MB）
3. 点击 Download，可以选择 "No thanks, just start my download" 跳过注册
4. 双击运行安装程序

### 2.2 安装步骤

1. **Choosing a Setup Type** → 选择 **Developer Default** ，点击 Next
   - 如果缺少 Visual C++ Redistributable，安装程序会提示下载，点击 Execute 自动安装
2. **Installation** → 点击 Execute 开始安装
3. **Product Configuration** → 点击 Next
4. **Type and Networking**：保持默认（TCP/IP, Port: 3306），Next
5. **Authentication Method**：选择 **Use Legacy Authentication Method (Retain MySQL 5.x Compatibility)** ，Next
   - （因为 Prisma 使用旧版认证方式兼容性更好）
6. **Accounts and Roles**：
   - Root 密码：设为 `root_password`（与项目默认配置保持一致）
   - 点击 Add User 创建项目用户：
     - User Name: `jiyun`
     - Host: `localhost`
     - Password: `jiyun_password`
     - Confirm Password: `jiyun_password`
   - 点击 OK，然后 Next
7. **Windows Service**：保持默认（Windows Service Name: MySQL80），Next
8. **Apply Configuration**：点击 Execute，等待完成，Finish

### 2.3 创建数据库

打开 PowerShell，使用 MySQL 客户端连接并创建数据库：

```powershell
# 方式一：通过 MySQL 命令行（安装时已加入 PATH）
mysql -u root -p
# 输入密码 root_password

# 方式二：通过 MySQL Workbench（安装时自动安装的图形界面工具）
# 在开始菜单中找到 MySQL Workbench 8.0 CE，打开后连接到 localhost:3306
```

在 MySQL 命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE jiyun CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 授权给 jiyun 用户（如果安装时没有创建用户，可以在这里创建）
-- CREATE USER 'jiyun'@'localhost' IDENTIFIED BY 'jiyun_password';
-- GRANT ALL PRIVILEGES ON jiyun.* TO 'jiyun'@'localhost';
-- FLUSH PRIVILEGES;

-- 如果已经在安装向导中创建了 jiyun 用户，授权即可：
GRANT ALL PRIVILEGES ON jiyun.* TO 'jiyun'@'localhost';
FLUSH PRIVILEGES;

-- 验证：退出后用 jiyun 用户重连
EXIT;
```

```powershell
# 验证 jiyun 用户可以连接
mysql -u jiyun -p jiyun
# 输入密码 jiyun_password，能成功进入 MySQL 即表示配置正确
```

### 2.4 验证 MySQL 服务运行状态

```powershell
# 方式一：查看 Windows 服务
Get-Service -Name MySQL80

# 方式二：通过命令行
mysqladmin -u root -p ping
# 输入密码后显示 "mysqld is alive" 表示服务正在运行
```

---

## 三、安装 Node.js 22.x

### 3.1 下载安装

1. 访问 Node.js 官网：`https://nodejs.org/`
2. 下载 **LTS 版本**（22.x），选择 **Windows Installer (.msi)** 64位
3. 双击运行安装程序
   - 勾选 "Automatically install the necessary tools" 可以自动安装 C++ 编译工具（推荐勾选）
   - 其他选项使用默认值
4. 完成安装

### 3.2 验证安装

打开 **新的** PowerShell 窗口：

```powershell
node --version
# 应显示 v22.x.x

npm --version
# 应显示 10.x.x
```

---

## 四、配置项目

### 4.1 打开项目目录

```powershell
cd "C:\共享文件夹\仿极云"
```

### 4.2 修改环境变量

项目根目录下已有 `.env` 文件，需要把数据库连接地址改为本地。用任意文本编辑器（如 VS Code、记事本）打开 `.env`，修改 `DATABASE_URL` 这一行：

```env
# 修改前（Docker 模式）
DATABASE_URL=mysql://jiyun:jiyun_password@mysql:3306/jiyun

# 修改后（本地 MySQL）
DATABASE_URL=mysql://jiyun:jiyun_password@localhost:3306/jiyun
```

完整的 `.env` 内容如下：

```env
NODE_ENV=development
APP_URL=http://localhost:5173
API_PORT=3000
DATABASE_URL=mysql://jiyun:jiyun_password@localhost:3306/jiyun
JWT_SECRET=change_me
COOKIE_SECRET=change_me
PASSWORD_ENCRYPTION_KEY=change_me_32_bytes
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=123456
EXPIRY_REMIND_DAYS=7
OVERDUE_SUSPEND_DAYS=3
UNPAID_ORDER_CANCEL_HOURS=24
```

> **注意**：`APP_URL` 这里改为 `http://localhost:5173`（Vite 前端开发服务器端口），非 Docker 模式下前端不经过 Nginx，直接从 Vite dev server 访问。

### 4.3 Vite 代理配置

项目已包含 `frontend/vite.config.js`，配置了 `/api` 请求代理到后端：

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

这个文件已经存在于项目中，无需额外修改。

---

## 五、初始化并启动项目

需要打开 **三个独立的 PowerShell 窗口**，分别运行后端、前端和 Worker。

### 5.1 初始化并启动后端（窗口1）

```powershell
cd "C:\共享文件夹\仿极云\backend"

# 1. 安装依赖
npm install

# 2. 生成 Prisma Client
npx prisma generate

# 3. 将 Prisma Schema 同步到 MySQL（创建/更新表结构）
npx prisma db push

# 4. 填充种子数据（创建管理员账号、上游数据源、系统设置）
node prisma/seed.js

# 5. 启动后端开发服务器（支持热重载）
npm run dev
```

看到以下输出表示后端启动成功：
```
Server running on port 3000
```

### 5.2 初始化并启动前端（窗口2）

```powershell
cd "C:\共享文件夹\仿极云\frontend"

# 1. 安装依赖
npm install

# 2. 启动前端开发服务器
npm run dev
```

看到类似以下输出表示前端启动成功：
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 5.3 启动 Worker 定时任务（窗口3）

```powershell
cd "C:\共享文件夹\仿极云\backend"

# 启动 Worker 进程（定时任务）
npm run worker
```

Worker 进程启动后会按照设定的频率执行定时任务（到期提醒、过期暂停、订单取消等）。

---

## 六、验证部署

### 6.1 访问前端页面

在浏览器中打开：**`http://localhost:5173`**

- 首页（客户门户）：直接显示产品列表和首页内容
- 管理后台：在页面中切换到管理后台登录界面

### 6.2 登录管理后台

1. 在浏览器访问 `http://localhost:5173`
2. 切换到管理后台登录界面
3. 输入默认管理员账号：
   - **用户名**：`admin`
   - **密码**：`123456`
4. 登录成功后进入管理后台仪表板

### 6.3 测试 API 是否正常

浏览器直接访问：`http://localhost:3000/api/health`

应返回：
```json
{
  "code": 0,
  "message": "ok",
  "data": { "status": "ok" }
}
```

---

## 七、完整启动流程速查

以下是每次重新启动项目的完整步骤（依赖已安装的前提下）：

**窗口1 - 后端**：
```powershell
cd "C:\共享文件夹\仿极云\backend"
npm run dev
```

**窗口2 - 前端**：
```powershell
cd "C:\共享文件夹\仿极云\frontend"
npm run dev
```

**窗口3 - Worker（可选）**：
```powershell
cd "C:\共享文件夹\仿极云\backend"
npm run worker
```

> **注意**：Worker 不是必须的，但如果不启动 Worker，服务器到期提醒、过期暂停、未支付订单自动取消等功能不会执行。

---

## 八、项目架构说明（非 Docker 模式）

```
浏览器访问 localhost:5173
        │
        ▼
   Vite Dev Server (:5173) ──── 静态文件 (React SPA)
        │
   /api/* 代理
        │
        ▼
   Express API (:3000)
   (backend)
        │
        ▼
   MySQL 8 (:3306)
   (本地 Windows 服务)
        │
        ▼
   Worker 进程（定时任务）
```

| 进程 | 端口 | 职责 |
|------|------|------|
| Vite Dev Server | 5173 | React 开发服务器，热更新，代理 /api 到后端 |
| Express API | 3000 | REST API，处理全部业务逻辑 |
| MySQL 8 | 3306 | 数据库，Windows 服务自动启动 |
| Worker | - | 定时任务（到期提醒、过期暂停、订单取消等） |

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

## 十、从 Docker 迁移数据到本地 MySQL

如果你之前用 Docker 运行过此项目，想把 Docker 中的数据迁移到本地 MySQL，可以使用导出的 SQL 文件：

```powershell
# 导入完整数据库（包含结构和数据）
mysql -u root -p jiyun < "C:\共享文件夹\仿极云\搭建说明\database_full.sql"
# 输入 root 密码
```

或者项目中提供的搭建说明文件夹中已有导出的 SQL 文件，可直接使用。

---

## 十一、常见操作

### 11.1 数据库操作

```powershell
# 连接 MySQL
mysql -u jiyun -p jiyun
# 输入密码: jiyun_password

# 常用 SQL
SHOW TABLES;                    -- 查看所有表
SELECT * FROM Admin;            -- 查看管理员
SELECT * FROM User;             -- 查看用户
SELECT * FROM SystemSetting;    -- 查看系统设置
SELECT * FROM Product;          -- 查看产品
```

### 11.2 重置数据库

```sql
-- 在 MySQL 中执行
DROP DATABASE jiyun;
CREATE DATABASE jiyun CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON jiyun.* TO 'jiyun'@'localhost';
FLUSH PRIVILEGES;
```

然后回到后端窗口，重新执行：
```powershell
cd "C:\共享文件夹\仿极云\backend"
npx prisma db push
node prisma/seed.js
```

### 11.3 只重置管理员密码

如果忘记管理员密码，可以修改 `.env` 中的 `ADMIN_DEFAULT_PASSWORD`，然后重新运行种子脚本：

```powershell
cd "C:\共享文件夹\仿极云\backend"
node prisma/seed.js
```

种子脚本使用 `upsert`，会更新已存在管理员的密码为你设置的新密码。

### 11.4 更新 Prisma Schema 后

如果修改了 `backend/prisma/schema.prisma`，需要重新同步：

```powershell
cd "C:\共享文件夹\仿极云\backend"
npx prisma generate   # 重新生成 Prisma Client
npx prisma db push    # 同步到数据库
```

---

## 十二、故障排查

### 12.1 MySQL 服务未启动

**现象**：后端报错 `Can't connect to MySQL server on 'localhost:3306'`

**解决**：
```powershell
# 检查 MySQL 服务状态
Get-Service -Name MySQL80

# 如果服务未运行，启动它
Start-Service -Name MySQL80

# 或者通过 Windows 服务管理器：
# 按 Win+R，输入 services.msc，找到 MySQL80，点击"启动"
```

### 12.2 端口冲突

**现象**：启动失败，提示端口被占用。

**解决**：
```powershell
# 查看端口占用情况
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :3306

# 如果有其他程序占用，可以修改端口：
# - 后端端口：修改 .env 中的 API_PORT
# - 前端端口：修改 vite.config.js 中的 server.port
# - MySQL 端口：MySQL 配置文件 my.ini
```

### 12.3 npm install 失败

**现象**：`npm install` 报错，依赖安装失败。

**排查步骤**：
1. 确认 Node.js 版本为 22.x：`node --version`
2. 清除 npm 缓存：`npm cache clean --force`
3. 删除 node_modules 重试：
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Force package-lock.json
   npm install
   ```
4. 如果网络问题导致下载缓慢，可配置国内镜像：
   ```powershell
   npm config set registry https://registry.npmmirror.com
   ```
   然后再执行 `npm install`

### 12.4 Prisma 连接数据库失败

**现象**：`prisma db push` 报错，无法连接数据库。

**排查**：
1. 检查 `.env` 中的 `DATABASE_URL` 是否正确（主机名应为 `localhost`）
2. 检查 MySQL 服务是否正在运行
3. 检查用户名和密码是否正确：
   ```powershell
   mysql -u jiyun -pjiyun_password jiyun
   ```
4. 检查数据库 `jiyun` 是否已创建

### 12.5 前端页面空白或 API 请求失败

**现象**：浏览器访问 `localhost:5173` 显示空白，或页面加载后 API 报错。

**排查**：
1. 确认前端 Vite 代理是否正常工作：打开浏览器 F12 → Network 标签，查看 `/api/` 请求的状态
2. 确认后端是否在 3000 端口正常运行
3. 直接访问 `http://localhost:3000/api/health` 确认后端 API 可用
4. 检查 `vite.config.js` 中的代理配置是否正确

### 12.6 bcrypt 或原生模块编译失败

**现象**：`npm install` 时 bcryptjs 报错（通常不会，因为项目使用的是纯 JS 版 `bcryptjs`）。

**解决**：本项目使用 `bcryptjs`（纯 JavaScript 实现），不需要编译。如果安装时出错，通常是网络问题，参考 12.3。

### 12.7 Windows 防火墙阻止连接

**现象**：后端启动了但前端无法访问。

**解决**：
1. 打开 Windows 防火墙设置
2. 确认 Node.js 被允许通过防火墙（通常首次启动时 Windows 会弹出提示）
3. 或者暂时关闭防火墙测试（不推荐长期关闭）

---

## 十三、快速命令参考

```powershell
# ========== MySQL 相关 ==========

# 启动/停止 MySQL 服务
Start-Service -Name MySQL80
Stop-Service -Name MySQL80
Restart-Service -Name MySQL80

# 查看 MySQL 服务状态
Get-Service -Name MySQL80

# 连接数据库
mysql -u jiyun -pjiyun_password jiyun

# 导入 SQL 文件
mysql -u root -p jiyun < database_full.sql

# ========== 后端相关 ==========

cd "C:\共享文件夹\仿极云\backend"

# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push

# 填充种子数据
node prisma/seed.js

# 启动开发服务器（热重载）
npm run dev

# 启动 Worker
npm run worker

# ========== 前端相关 ==========

cd "C:\共享文件夹\仿极云\frontend"

# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev

# 构建生产版本
npm run build

# ========== 端口排查 ==========

netstat -ano | findstr :3000    # 后端端口
netstat -ano | findstr :5173    # 前端端口
netstat -ano | findstr :3306    # MySQL 端口

# 结束占用端口的进程（将 PID 替换为实际值）
taskkill /PID <PID> /F
```

---

## 十四、生产环境注意事项

1. **修改所有默认密钥**：`JWT_SECRET`、`COOKIE_SECRET`、`PASSWORD_ENCRYPTION_KEY` 必须改为随机强密码
2. **修改默认管理员密码**：首次登录后立即修改
3. **使用 HTTPS**：生产环境应通过 Nginx 或 IIS 配置 SSL/TLS 证书
4. **数据库备份**：定期使用 `mysqldump` 备份数据库
5. **前端构建**：生产环境使用 `npm run build` 构建静态文件，通过 Nginx 或 IIS 提供服务
6. **进程守护**：生产环境建议使用 PM2 管理 Node.js 进程，实现自动重启和日志管理
