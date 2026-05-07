# 10. 插件使用策略

## 目的

已安装插件需要纳入执行计划，但不能为了使用插件而使用插件。插件只用于提高实现质量、视觉质量、部署效率或交付文档质量。

后续每次进入对应任务前，先对照本文件判断是否需要启用插件能力。

## 已安装插件

- Build Web Apps
- Canva
- Documents
- Game Studio
- Presentations
- Remotion
- Spreadsheets
- Vercel

## 总体使用规则

- Web 应用开发优先使用 Build Web Apps 的思路和能力。
- 视觉素材、品牌图、官网 Banner、产品图优先考虑 Canva。
- 动态视频、首页短动画、宣传视频素材优先考虑 Remotion。
- 正式合同、服务条款、隐私政策、部署手册优先考虑 Documents。
- 产品价格表、服务器导入模板、验收表、财务对账表优先考虑 Spreadsheets。
- 演示汇报、销售介绍、项目交付说明优先考虑 Presentations。
- 在线预览和部署辅助优先考虑 Vercel，但生产主方案仍以 Docker Compose 为准。
- Game Studio 只在需要游戏化互动、机房拓扑小游戏、演示型可视化玩法时使用；本项目常规业务开发默认不用。

## 按模块使用插件

### 官网首页

建议插件：

- Build Web Apps
- Canva
- Remotion

用途：

- Build Web Apps：实现官网首页、响应式布局、交互动效、组件结构。
- Canva：制作品牌主视觉、机房背景、产品插图、图标风格参考。
- Remotion：制作可嵌入首页的轻量宣传动画或服务器网络流动短视频。

首页建议特效：

- Hero 区使用真实机房或服务器视觉背景，不使用纯渐变假背景。
- 首屏可以做轻量粒子网络线条、服务器状态光点、带宽流动线，必须保证性能和移动端可用。
- 核心卖点数字可做滚动计数动画，例如在线节点、客户数量、防护能力、交付时间。
- 产品卡片 hover 时只做轻量上浮、边框高亮、按钮强调，不做夸张动画。
- 页面滚动出现时可做淡入和位移动画，但不能影响内容读取。
- 首页动画必须可降级；低性能设备不能白屏。

落地要求：

- 动效最终必须写进 React/CSS，或作为 Remotion/Canva 产物导出后引入。
- 不允许只生成设计图而不落地到代码。
- 不允许为了炫技加入影响加载速度的大体积动画。

### 服务器购买页

建议插件：

- Build Web Apps
- Canva
- Spreadsheets

用途：

- Build Web Apps：实现套餐筛选、周期切换、订单确认、余额支付。
- Canva：制作产品类型图标或套餐视觉素材。
- Spreadsheets：维护初始产品价格表、套餐配置表、服务器导入模板。

落地要求：

- 产品必须来自数据库。
- 价格、库存、上下架状态必须来自 API。
- Spreadsheets 只能作为导入或整理工具，不能代替数据库。

### 客户后台

建议插件：

- Build Web Apps
- Spreadsheets

用途：

- Build Web Apps：实现客户总览、服务器列表、订单、余额流水、通知、工单。
- Spreadsheets：导出订单流水、服务器列表、财务流水。

界面要求：

- 客户后台是高频操作界面，应密集、清晰、稳定。
- 不使用营销式大 Hero。
- 表格、状态标签、筛选、操作按钮优先考虑可读性。

### 总后台

建议插件：

- Build Web Apps
- Spreadsheets
- Documents

用途：

- Build Web Apps：后台管理页、表格、表单、弹窗、状态流转。
- Spreadsheets：批量导入服务器、导出订单、导出用户、导出财务流水。
- Documents：生成后台操作手册、客服处理规范、服务条款。

界面要求：

- 后台使用简体中文。
- 布局偏管理系统，不做官网式装饰。
- 每个关键表格都要考虑筛选、分页、状态标签和操作确认。

### 登录注册

建议插件：

- Build Web Apps

用途：

- 客户登录、客户注册、管理员登录、路由守卫、错误提示、表单校验。

落地要求：

- 必须接后端认证接口。
- 不允许继续使用前端写死账号判断。
- 注册、登录、退出都必须真实改变服务端登录态。

### 到期、续费和通知

建议插件：

- Build Web Apps
- Spreadsheets

用途：

- Build Web Apps：续费页面、到期状态、通知中心。
- Spreadsheets：到期服务器导出、续费价格核对。

落地要求：

- 到期状态必须由 worker 和数据库计算。
- 前端只展示状态，不能自己决定服务器是否到期。

### 工单和客服文档

建议插件：

- Build Web Apps
- Documents

用途：

- Build Web Apps：工单列表、工单详情、回复框、状态流转。
- Documents：服务条款、隐私政策、退款说明、客服 SOP。

### 财务和报表

建议插件：

- Build Web Apps
- Spreadsheets

用途：

- Build Web Apps：余额、充值、扣款、退款、流水页面。
- Spreadsheets：导出财务流水、订单报表、月度收入表。

落地要求：

- 所有金额变动必须先写数据库流水。
- 导出的表格只是结果，不是财务数据源。

### 部署和预览

建议插件：

- Vercel

用途：

- 前端预览部署。
- 演示环境评估。
- 如后续需要公开预览链接，可以用 Vercel 辅助。

限制：

- 本项目主要部署目标是 Docker Compose。
- Vercel 不能替代 MySQL、worker、后台 API 的生产部署方案。
- 若使用 Vercel，只适合作为前端或轻量预览层。

### 项目汇报和交付材料

建议插件：

- Presentations
- Documents
- Spreadsheets
- Canva

用途：

- Presentations：制作项目介绍、功能清单、运营流程汇报。
- Documents：制作部署文档、操作手册、服务协议。
- Spreadsheets：制作验收清单、测试记录、价格表。
- Canva：制作品牌视觉、宣传图。

## 不建议使用的场景

### Game Studio

默认不用于本项目。

可用场景：

- 后续如果需要“机房拓扑互动演示”。
- 后续如果需要“网络攻击防护可视化小游戏”作为宣传页面。

当前运营系统主流程不需要 Game Studio。

### Remotion

不用于后台和客户后台常规功能。

适合：

- 官网首屏短视频。
- 产品介绍动画。
- 品牌宣传动效。

限制：

- 动画不能阻塞首屏渲染。
- 动画必须有静态 fallback。

## 页面特效执行提醒

### 首页可做

- 真实机房背景图。
- 服务器状态光点。
- 网络流动线。
- 数字计数动画。
- 产品卡片轻量 hover。
- 首屏 CTA 按钮微交互。
- 滚动进入淡入。

### 首页不要做

- 不要用纯渐变当主视觉。
- 不要放无意义光球、漂浮装饰。
- 不要做过重 3D 导致移动端卡顿。
- 不要让动画遮挡文字和购买按钮。
- 不要让视频成为唯一内容载体。

### 后台可做

- 表格状态颜色。
- 操作确认弹窗。
- 加载状态。
- 空状态。
- 批量操作反馈。

### 后台不要做

- 不要做营销式 Hero。
- 不要做大面积装饰背景。
- 不要为了动效降低表格密度。

## 阶段执行时的插件提醒

- 阶段 1：Build Web Apps、Vercel。
- 阶段 2：Build Web Apps。
- 阶段 3：Build Web Apps、Canva、Spreadsheets。
- 阶段 4：Build Web Apps、Spreadsheets。
- 阶段 5：Build Web Apps、Spreadsheets。
- 阶段 6：Build Web Apps、Documents。
- 阶段 7：Documents、Spreadsheets、Presentations、Vercel。

执行任何阶段时，如果要做视觉素材，先判断是否用 Canva；如果要做宣传动画，先判断是否用 Remotion；如果要输出正式文档，先判断是否用 Documents；如果要导入导出表格，先判断是否用 Spreadsheets。
