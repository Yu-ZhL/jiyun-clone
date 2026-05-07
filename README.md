# 极云主机管理系统仿站

一个前端演示版主机管理系统，包含前台官网、服务器购买页、总后台、客户后台。数据保存在浏览器 `localStorage`，管理员可手动录入服务器信息，不接入第三方 API。

## 功能

- 前台官网使用香港繁体文案
- 服务器购买页支持月付 / 年付下单
- 客户后台查看服务器、订单、工单与余额
- 总后台使用简体中文，账号 `admin`，密码 `123456`
- 总后台可新增产品、手动录入服务器、查看订单和用户
- 用户管理里可以点击“进入前台”，模拟自动登录指定客户

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`。

## Docker 运行

```bash
docker build -t jiyun-clone .
docker run --rm -p 8080:80 jiyun-clone
```

访问 `http://localhost:8080`。
