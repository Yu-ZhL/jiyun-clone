import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { decryptPassword, encryptPassword, hashToken, randomToken } from './utils/crypto.js';
import { runAllJobs } from './jobs/index.js';

export const prisma = new PrismaClient();

const USER_COOKIE = 'jiyun_user_token';
const ADMIN_COOKIE = 'jiyun_admin_token';
const dayMs = 24 * 60 * 60 * 1000;

function ok(res, data = null, message = 'ok') {
  return res.json({ code: 0, message, data });
}

function fail(res, code, message, status = 400) {
  return res.status(status).json({ code, message, data: null });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * dayMs
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'change_me', { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'change_me');
  } catch {
    return null;
  }
}

function requestIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

async function requireUser(req, res, next) {
  const payload = verifyToken(req.cookies[USER_COOKIE]);
  if (!payload || payload.purpose !== 'user') return fail(res, 40101, '请先登录', 401);
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || user.status !== 'active') return fail(res, 40102, '账号不可用', 401);
  req.user = user;
  return next();
}

async function requireAdmin(req, res, next) {
  const payload = verifyToken(req.cookies[ADMIN_COOKIE]);
  if (!payload || payload.purpose !== 'admin') return fail(res, 40111, '请先登录后台', 401);
  const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
  if (!admin || admin.status !== 'active') return fail(res, 40112, '管理员不可用', 401);
  req.admin = admin;
  return next();
}

async function logOperation(req, action, targetType, targetId, detail) {
  await prisma.operationLog.create({
    data: {
      adminId: req.admin?.id,
      action,
      targetType,
      targetId,
      detail: detail ? JSON.stringify(detail) : null,
      ip: requestIp(req),
      userAgent: req.headers['user-agent']
    }
  });
}

function orderNo(prefix = 'JY') {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${prefix}${stamp}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function addCycle(date, cycle) {
  const next = new Date(date);
  if (cycle === 'yearly') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

async function completePaidOrder(tx, order) {
  if (order.type === 'renew_server' && order.serverId) {
    const server = await tx.server.findUnique({ where: { id: order.serverId } });
    if (!server) throw new Error('续费服务器不存在');
    const baseDate = server.expiresAt > new Date() ? server.expiresAt : new Date();
    const newExpiresAt = addCycle(baseDate, order.cycle);
    await tx.server.update({
      where: { id: server.id },
      data: { expiresAt: newExpiresAt, status: 'running', suspendedAt: null }
    });
    await tx.renewal.create({
      data: {
        serverId: server.id,
        orderId: order.id,
        oldExpiresAt: server.expiresAt,
        newExpiresAt
      }
    });
    await tx.notification.create({
      data: {
        userId: order.userId,
        type: 'renewal_paid',
        title: '服务器续费成功',
        content: `${server.name} 已续费至 ${newExpiresAt.toISOString().slice(0, 10)}`
      }
    });
    return { provisionStatus: 'opened' };
  }

  if (order.type === 'new_server') {
    return { provisionStatus: 'pending' };
  }

  return {};
}

async function payOrderWithBalance(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { product: true, server: true } });
    if (!order) throw new Error('订单不存在');
    if (order.payStatus !== 'unpaid') throw new Error('订单不是未支付状态');

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < order.amount) throw new Error('余额不足');

    const balanceAfter = user.balance - order.amount;
    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });
    await tx.walletTransaction.create({
      data: {
        userId,
        type: 'payment',
        amount: -order.amount,
        balanceBefore: user.balance,
        balanceAfter,
        relatedOrderId: order.id,
        remark: `支付订单 ${order.orderNo}`
      }
    });

    const completion = await completePaidOrder(tx, order);
    return tx.order.update({
      where: { id: order.id },
      data: {
        payMethod: 'balance',
        payStatus: 'paid',
        provisionStatus: completion.provisionStatus || order.provisionStatus,
        paidAt: new Date()
      }
    });
  });
}

function serializeServer(server, includePassword = false) {
  if (!server) return null;
  const { loginPasswordEncrypted: _encrypted, ...rest } = server;
  return {
    ...rest,
    loginPassword: includePassword ? decryptPassword(server.loginPasswordEncrypted) : undefined
  };
}

function productPayload(body, partial = false) {
  const data = {};
  const stringFields = ['name', 'type', 'location', 'cpu', 'memory', 'disk', 'bandwidth', 'defense', 'status', 'description'];
  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = String(body[field]);
  }
  if (body.priceMonthly !== undefined) data.priceMonthly = cents(body.priceMonthly);
  if (body.priceYearly !== undefined) data.priceYearly = cents(body.priceYearly);
  if (body.stock !== undefined) data.stock = Number(body.stock || 0);
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder || 0);

  if (!partial) {
    return {
      type: '云服务器',
      location: '中国香港',
      cpu: '2 vCPU',
      memory: '4 GB',
      disk: '80 GB SSD',
      bandwidth: '10M CN2',
      defense: '20G 防护',
      stock: 0,
      status: 'on_sale',
      description: '',
      ...data
    };
  }
  return data;
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:8080',
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  app.get('/api/health', asyncRoute(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { service: 'backend', database: 'ok', timestamp: new Date().toISOString() });
  }));

  app.get('/api/site-settings', asyncRoute(async (_req, res) => {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ['site_name', 'support_phone', 'support_email', 'copyright', 'hero_title', 'hero_subtitle'] } }
    });
    ok(res, Object.fromEntries(rows.map((row) => [row.key, row.value])));
  }));

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const { username, email, password, phone } = req.body;
    const registrationSetting = await prisma.systemSetting.findUnique({ where: { key: 'registration_enabled' } });
    if (registrationSetting?.value === 'false') return fail(res, 40003, '暂未开放注册');
    if (!username || !email || !password || password.length < 6) return fail(res, 40001, '用户名、邮箱和至少 6 位密码必填');
    const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (exists) return fail(res, 40002, '用户名或邮箱已存在');
    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        registerIp: requestIp(req),
        status: 'active'
      }
    });
    res.cookie(USER_COOKIE, signToken({ id: user.id, purpose: 'user' }), cookieOptions());
    ok(res, publicUser(user));
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const { account, password } = req.body;
    const user = await prisma.user.findFirst({ where: { OR: [{ username: account || '' }, { email: account || '' }] } });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return fail(res, 40103, '账号或密码错误', 401);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.cookie(USER_COOKIE, signToken({ id: user.id, purpose: 'user' }), cookieOptions());
    ok(res, publicUser(user));
  }));

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(USER_COOKIE);
    ok(res);
  });

  app.get('/api/auth/me', asyncRoute(async (req, res) => {
    const payload = verifyToken(req.cookies[USER_COOKIE]);
    if (!payload || payload.purpose !== 'user') return ok(res, null);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status !== 'active') return ok(res, null);
    ok(res, publicUser(user));
  }));

  app.post('/api/auth/impersonate', asyncRoute(async (req, res) => {
    const { token } = req.body;
    const tokenHash = hashToken(token || '');
    const record = await prisma.impersonationToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt < new Date()) return fail(res, 40104, '代登录 token 无效', 401);
    await prisma.impersonationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await prisma.operationLog.create({
      data: {
        adminId: record.adminId,
        action: 'impersonation_use',
        targetType: 'user',
        targetId: record.userId,
        ip: requestIp(req),
        userAgent: req.headers['user-agent']
      }
    });
    res.cookie(USER_COOKIE, signToken({ id: record.userId, purpose: 'user' }), cookieOptions());
    ok(res, publicUser(record.user));
  }));

  app.post('/api/admin/auth/login', asyncRoute(async (req, res) => {
    const { username, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { username: username || '' } });
    if (!admin || !(await bcrypt.compare(password || '', admin.passwordHash))) return fail(res, 40113, '账号或密码错误', 401);
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    res.cookie(ADMIN_COOKIE, signToken({ id: admin.id, purpose: 'admin' }), cookieOptions());
    ok(res, { id: admin.id, username: admin.username, name: admin.name, role: admin.role });
  }));

  app.post('/api/admin/auth/logout', (_req, res) => {
    res.clearCookie(ADMIN_COOKIE);
    ok(res);
  });

  app.get('/api/admin/auth/me', asyncRoute(async (req, res) => {
    const payload = verifyToken(req.cookies[ADMIN_COOKIE]);
    if (!payload || payload.purpose !== 'admin') return ok(res, null);
    const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
    if (!admin || admin.status !== 'active') return ok(res, null);
    ok(res, { id: admin.id, username: admin.username, name: admin.name, role: admin.role });
  }));

  app.get('/api/products', asyncRoute(async (_req, res) => {
    ok(res, await prisma.product.findMany({ where: { status: 'on_sale' }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }));
  }));

  app.get('/api/products/:id', asyncRoute(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.status !== 'on_sale') return fail(res, 40401, '产品不存在', 404);
    ok(res, product);
  }));

  app.post('/api/orders', requireUser, asyncRoute(async (req, res) => {
    const { productId, cycle } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'on_sale') return fail(res, 40011, '产品不可购买');
    const normalizedCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = normalizedCycle === 'yearly' ? product.priceYearly : product.priceMonthly;
    const order = await prisma.order.create({
      data: {
        orderNo: orderNo(),
        userId: req.user.id,
        productId: product.id,
        type: 'new_server',
        cycle: normalizedCycle,
        amount,
        payStatus: 'unpaid',
        provisionStatus: 'none'
      }
    });
    ok(res, order);
  }));

  app.post('/api/orders/:id/pay-with-balance', requireUser, asyncRoute(async (req, res) => {
    try {
      ok(res, await payOrderWithBalance(req.params.id, req.user.id));
    } catch (error) {
      fail(res, 40012, error.message);
    }
  }));

  app.get('/api/client/summary', requireUser, asyncRoute(async (req, res) => {
    const [orders, servers, tickets, notifications] = await Promise.all([
      prisma.order.count({ where: { userId: req.user.id } }),
      prisma.server.count({ where: { userId: req.user.id, deletedAt: null } }),
      prisma.ticket.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } })
    ]);
    ok(res, { user: publicUser(req.user), orders, servers, tickets, unreadNotifications: notifications });
  }));

  app.get('/api/client/orders', requireUser, asyncRoute(async (req, res) => {
    ok(res, await prisma.order.findMany({ where: { userId: req.user.id }, include: { product: true, server: true }, orderBy: { createdAt: 'desc' } }));
  }));

  app.get('/api/client/servers', requireUser, asyncRoute(async (req, res) => {
    const servers = await prisma.server.findMany({ where: { userId: req.user.id, deletedAt: null }, include: { product: true }, orderBy: { createdAt: 'desc' } });
    ok(res, servers.map((server) => serializeServer(server, true)));
  }));

  app.get('/api/client/servers/:id', requireUser, asyncRoute(async (req, res) => {
    const server = await prisma.server.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { product: true } });
    if (!server) return fail(res, 40402, '服务器不存在', 404);
    ok(res, serializeServer(server, true));
  }));

  app.post('/api/client/servers/:id/renew', requireUser, asyncRoute(async (req, res) => {
    const server = await prisma.server.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { product: true } });
    if (!server) return fail(res, 40402, '服务器不存在', 404);
    const cycle = req.body.cycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? server.product.priceYearly : server.product.priceMonthly;
    const order = await prisma.order.create({
      data: {
        orderNo: orderNo('RN'),
        userId: req.user.id,
        productId: server.productId,
        serverId: server.id,
        type: 'renew_server',
        cycle,
        amount,
        payStatus: 'unpaid',
        provisionStatus: 'none'
      }
    });
    ok(res, order);
  }));

  app.get('/api/client/wallet/transactions', requireUser, asyncRoute(async (req, res) => {
    ok(res, await prisma.walletTransaction.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }));
  }));

  app.get('/api/client/notifications', requireUser, asyncRoute(async (req, res) => {
    ok(res, await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }));
  }));

  app.post('/api/client/notifications/:id/read', requireUser, asyncRoute(async (req, res) => {
    const notification = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return fail(res, 40405, '通知不存在', 404);
    ok(res, await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } }));
  }));

  app.get('/api/client/tickets', requireUser, asyncRoute(async (req, res) => {
    ok(res, await prisma.ticket.findMany({ where: { userId: req.user.id }, include: { replies: true }, orderBy: { updatedAt: 'desc' } }));
  }));

  app.post('/api/client/tickets', requireUser, asyncRoute(async (req, res) => {
    const { title, category, content } = req.body;
    if (!title || !content) return fail(res, 40021, '标题和内容必填');
    const ticket = await prisma.ticket.create({
      data: {
        userId: req.user.id,
        title,
        category: category || 'support',
        replies: { create: { senderType: 'user', senderId: req.user.id, content } }
      },
      include: { replies: true }
    });
    ok(res, ticket);
  }));

  app.post('/api/client/tickets/:id/replies', requireUser, asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!ticket) return fail(res, 40403, '工单不存在', 404);
    if (!req.body.content) return fail(res, 40022, '回复内容必填');
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'open' } });
    ok(res, await prisma.ticketReply.create({ data: { ticketId: ticket.id, senderType: 'user', senderId: req.user.id, content: req.body.content } }));
  }));

  app.post('/api/client/tickets/:id/close', requireUser, asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!ticket) return fail(res, 40403, '工单不存在', 404);
    ok(res, await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'closed', closedAt: new Date() } }));
  }));

  app.get('/api/admin/dashboard/summary', requireAdmin, asyncRoute(async (_req, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const [users, products, orders, servers, tickets, income, unpaidOrders, paidPendingOrders, expiringServers, openTickets, recentOrders] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.server.count({ where: { deletedAt: null } }),
      prisma.ticket.count(),
      prisma.order.aggregate({ where: { payStatus: 'paid' }, _sum: { amount: true } }),
      prisma.order.count({ where: { payStatus: 'unpaid' } }),
      prisma.order.count({ where: { payStatus: 'paid', provisionStatus: 'pending', type: 'new_server' } }),
      prisma.server.count({ where: { status: 'expiring', deletedAt: null } }),
      prisma.ticket.count({ where: { status: { in: ['open', 'replied'] } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { amount: true, payStatus: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since);
      date.setDate(since.getDate() + index);
      return { date: date.toISOString().slice(0, 10), orders: 0, income: 0 };
    });
    for (const order of recentOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const day = daily.find((item) => item.date === key);
      if (day) {
        day.orders += 1;
        if (order.payStatus === 'paid') day.income += order.amount;
      }
    }
    ok(res, {
      users,
      products,
      orders,
      servers,
      tickets,
      income: income._sum.amount || 0,
      unpaidOrders,
      paidPendingOrders,
      expiringServers,
      openTickets,
      daily
    });
  }));

  app.get('/api/admin/users', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.user.findMany({ orderBy: { createdAt: 'desc' } }));
  }));

  app.get('/api/admin/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { orders: true, servers: true, walletLogs: true, tickets: true }
    });
    if (!user) return fail(res, 40404, '用户不存在', 404);
    ok(res, user);
  }));

  app.put('/api/admin/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const data = {};
    for (const key of ['email', 'phone', 'status']) {
      if (req.body[key] !== undefined) data[key] = String(req.body[key]);
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await logOperation(req, 'update_user', 'user', user.id, data);
    ok(res, user);
  }));

  app.post('/api/admin/users/:id/adjust-balance', requireAdmin, asyncRoute(async (req, res) => {
    const amount = cents(req.body.amount);
    const remark = req.body.remark || '后台手动充值';
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: req.params.id } });
        if (!user) throw new Error('用户不存在');
        const balanceAfter = user.balance + amount;
        if (balanceAfter < 0) throw new Error('余额不能调整为负数');
        await tx.user.update({ where: { id: user.id }, data: { balance: balanceAfter } });
        return tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: amount >= 0 ? 'recharge' : 'adjustment',
            amount,
            balanceBefore: user.balance,
            balanceAfter,
            adminId: req.admin.id,
            remark
          }
        });
      });
      await logOperation(req, 'adjust_balance', 'user', req.params.id, { amount, remark });
      ok(res, result);
    } catch (error) {
      fail(res, 40051, error.message);
    }
  }));

  app.post('/api/admin/users/:id/disable', requireAdmin, asyncRoute(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'disabled' } });
    await logOperation(req, 'disable_user', 'user', user.id);
    ok(res, user);
  }));

  app.post('/api/admin/users/:id/enable', requireAdmin, asyncRoute(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'active' } });
    await logOperation(req, 'enable_user', 'user', user.id);
    ok(res, user);
  }));

  app.post('/api/admin/users/:id/impersonate', requireAdmin, asyncRoute(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return fail(res, 40404, '用户不存在', 404);
    const token = randomToken();
    await prisma.impersonationToken.create({
      data: {
        adminId: req.admin.id,
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    await logOperation(req, 'impersonation_create', 'user', user.id);
    ok(res, { token });
  }));

  app.get('/api/admin/products', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }));
  }));

  app.post('/api/admin/products', requireAdmin, asyncRoute(async (req, res) => {
    const data = productPayload(req.body);
    if (!data.name || !data.priceMonthly || !data.priceYearly) return fail(res, 40031, '产品名称和价格必填');
    const product = await prisma.product.create({ data });
    await logOperation(req, 'create_product', 'product', product.id, data);
    ok(res, product);
  }));

  app.get('/api/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return fail(res, 40401, '产品不存在', 404);
    ok(res, product);
  }));

  app.put('/api/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const data = productPayload(req.body, true);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    await logOperation(req, 'update_product', 'product', product.id, data);
    ok(res, product);
  }));

  app.post('/api/admin/products/:id/on-sale', requireAdmin, asyncRoute(async (req, res) => {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: 'on_sale' } });
    await logOperation(req, 'product_on_sale', 'product', product.id);
    ok(res, product);
  }));

  app.post('/api/admin/products/:id/off-sale', requireAdmin, asyncRoute(async (req, res) => {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: 'off_sale' } });
    await logOperation(req, 'product_off_sale', 'product', product.id);
    ok(res, product);
  }));

  app.delete('/api/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const used = await prisma.order.count({ where: { productId: req.params.id } });
    if (used > 0) return fail(res, 40032, '已有订单的产品不能删除，请改为下架');
    const product = await prisma.product.delete({ where: { id: req.params.id } });
    await logOperation(req, 'delete_product', 'product', product.id);
    ok(res, product);
  }));

  app.get('/api/admin/orders', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.order.findMany({ include: { user: true, product: true, server: true }, orderBy: { createdAt: 'desc' } }));
  }));

  app.get('/api/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true, product: true, server: true, walletLogs: true, renewals: true } });
    if (!order) return fail(res, 40406, '订单不存在', 404);
    ok(res, order);
  }));

  app.post('/api/admin/orders/:id/mark-paid', requireAdmin, asyncRoute(async (req, res) => {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new Error('订单不存在');
        if (existing.payStatus !== 'unpaid') throw new Error('订单不是未支付状态');
        const completion = await completePaidOrder(tx, existing);
        return tx.order.update({
          where: { id: existing.id },
          data: {
            payStatus: 'paid',
            payMethod: 'manual',
            paidAt: new Date(),
            provisionStatus: completion.provisionStatus || existing.provisionStatus
          }
        });
      });
      await logOperation(req, 'mark_order_paid', 'order', order.id);
      ok(res, order);
    } catch (error) {
      fail(res, 40052, error.message);
    }
  }));

  app.post('/api/admin/orders/:id/cancel', requireAdmin, asyncRoute(async (req, res) => {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { payStatus: 'cancelled', cancelledAt: new Date() } });
    await logOperation(req, 'cancel_order', 'order', order.id);
    ok(res, order);
  }));

  app.post('/api/admin/orders/:id/refund', requireAdmin, asyncRoute(async (req, res) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: req.params.id }, include: { user: true } });
        if (!order) throw new Error('订单不存在');
        if (order.payStatus !== 'paid') throw new Error('只有已支付订单可以退款');
        const balanceAfter = order.user.balance + order.amount;
        await tx.user.update({ where: { id: order.userId }, data: { balance: balanceAfter } });
        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            type: 'refund',
            amount: order.amount,
            balanceBefore: order.user.balance,
            balanceAfter,
            relatedOrderId: order.id,
            adminId: req.admin.id,
            remark: req.body.remark || `订单 ${order.orderNo} 后台退款`
          }
        });
        return tx.order.update({ where: { id: order.id }, data: { payStatus: 'refunded' } });
      });
      await logOperation(req, 'refund_order', 'order', result.id, req.body);
      ok(res, result);
    } catch (error) {
      fail(res, 40053, error.message);
    }
  }));

  app.get('/api/admin/servers', requireAdmin, asyncRoute(async (_req, res) => {
    const servers = await prisma.server.findMany({ include: { user: true, product: true, order: true }, orderBy: { createdAt: 'desc' } });
    ok(res, servers.map((server) => serializeServer(server, false)));
  }));

  app.get('/api/admin/servers/:id', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.findUnique({ where: { id: req.params.id }, include: { user: true, product: true, order: true, renewals: true } });
    if (!server) return fail(res, 40402, '服务器不存在', 404);
    ok(res, serializeServer(server, false));
  }));

  app.post('/api/admin/servers', requireAdmin, asyncRoute(async (req, res) => {
    const { orderId, userId, productId, name, ip, os, loginUser, loginPassword, expiresAt, panelUrl } = req.body;
    const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    const data = {
      userId: order?.userId || userId,
      productId: order?.productId || productId,
      orderId: order?.id,
      name,
      ip,
      os,
      loginUser,
      loginPasswordEncrypted: encryptPassword(loginPassword || ''),
      panelUrl,
      status: 'running',
      openedAt: new Date(),
      expiresAt: new Date(expiresAt)
    };
    if (!data.userId || !data.productId || !name || !ip || !loginPassword || Number.isNaN(data.expiresAt.getTime())) {
      return fail(res, 40041, '开通资料不完整');
    }
    const server = await prisma.server.create({ data });
    if (order) await prisma.order.update({ where: { id: order.id }, data: { provisionStatus: 'opened', openedAt: new Date() } });
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'server_opened',
        title: '服务器已开通',
        content: `${name} 已开通，IP：${ip}`
      }
    });
    await logOperation(req, 'open_server', 'server', server.id, { orderId });
    ok(res, serializeServer(server, false));
  }));

  app.put('/api/admin/servers/:id', requireAdmin, asyncRoute(async (req, res) => {
    const data = {};
    for (const key of ['name', 'ip', 'os', 'loginUser', 'panelUrl', 'status']) {
      if (req.body[key] !== undefined) data[key] = String(req.body[key]);
    }
    if (req.body.loginPassword) data.loginPasswordEncrypted = encryptPassword(req.body.loginPassword);
    if (req.body.expiresAt) data.expiresAt = new Date(req.body.expiresAt);
    const server = await prisma.server.update({ where: { id: req.params.id }, data });
    await logOperation(req, 'update_server', 'server', server.id, { ...data, loginPasswordEncrypted: data.loginPasswordEncrypted ? '[encrypted]' : undefined });
    ok(res, serializeServer(server, false));
  }));

  app.post('/api/admin/servers/:id/open', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.update({ where: { id: req.params.id }, data: { status: 'running', openedAt: new Date(), suspendedAt: null } });
    await logOperation(req, 'open_server_status', 'server', server.id);
    ok(res, serializeServer(server, false));
  }));

  app.post('/api/admin/servers/:id/suspend', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.update({ where: { id: req.params.id }, data: { status: 'suspended', suspendedAt: new Date() } });
    await logOperation(req, 'suspend_server', 'server', server.id);
    ok(res, server);
  }));

  app.post('/api/admin/servers/:id/resume', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.update({ where: { id: req.params.id }, data: { status: 'running', suspendedAt: null } });
    await logOperation(req, 'resume_server', 'server', server.id);
    ok(res, server);
  }));

  app.post('/api/admin/servers/:id/extend', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.findUnique({ where: { id: req.params.id } });
    if (!server) return fail(res, 40402, '服务器不存在', 404);
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : addCycle(server.expiresAt > new Date() ? server.expiresAt : new Date(), req.body.cycle);
    if (Number.isNaN(expiresAt.getTime())) return fail(res, 40042, '到期时间无效');
    const updated = await prisma.server.update({ where: { id: server.id }, data: { expiresAt, status: 'running', suspendedAt: null } });
    await logOperation(req, 'extend_server', 'server', server.id, { expiresAt });
    ok(res, serializeServer(updated, false));
  }));

  app.post('/api/admin/servers/:id/delete', requireAdmin, asyncRoute(async (req, res) => {
    const server = await prisma.server.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: 'deleted' } });
    await logOperation(req, 'delete_server', 'server', server.id);
    ok(res, serializeServer(server, false));
  }));

  app.get('/api/admin/tickets', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.ticket.findMany({ include: { user: true, replies: true }, orderBy: { updatedAt: 'desc' } }));
  }));

  app.get('/api/admin/tickets/:id', requireAdmin, asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { user: true, replies: true } });
    if (!ticket) return fail(res, 40403, '工单不存在', 404);
    ok(res, ticket);
  }));

  app.post('/api/admin/tickets/:id/replies', requireAdmin, asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return fail(res, 40403, '工单不存在', 404);
    if (!req.body.content) return fail(res, 40022, '回复内容必填');
    const reply = await prisma.ticketReply.create({ data: { ticketId: req.params.id, senderType: 'admin', senderId: req.admin.id, content: req.body.content } });
    await prisma.ticket.update({ where: { id: req.params.id }, data: { status: 'replied' } });
    await logOperation(req, 'reply_ticket', 'ticket', req.params.id);
    ok(res, reply);
  }));

  app.post('/api/admin/tickets/:id/close', requireAdmin, asyncRoute(async (req, res) => {
    const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data: { status: 'closed', closedAt: new Date() } });
    await logOperation(req, 'close_ticket', 'ticket', ticket.id);
    ok(res, ticket);
  }));

  app.get('/api/admin/settings', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }));
  }));

  app.put('/api/admin/settings', requireAdmin, asyncRoute(async (req, res) => {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      await prisma.systemSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    await logOperation(req, 'update_settings', 'system_settings', null, req.body);
    ok(res, await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }));
  }));

  app.get('/api/admin/operation-logs', requireAdmin, asyncRoute(async (_req, res) => {
    ok(res, await prisma.operationLog.findMany({ include: { admin: true }, orderBy: { createdAt: 'desc' }, take: 200 }));
  }));

  app.post('/api/admin/jobs/run', requireAdmin, asyncRoute(async (req, res) => {
    const result = await runAllJobs(prisma);
    await logOperation(req, 'run_jobs', 'system_jobs', null, result);
    ok(res, result);
  }));

  app.use('/api', (_req, res) => fail(res, 40400, 'API endpoint not found', 404));

  app.use((error, _req, res, _next) => {
    console.error(error);
    fail(res, 50000, error.message || '服务器错误', 500);
  });

  return app;
}
