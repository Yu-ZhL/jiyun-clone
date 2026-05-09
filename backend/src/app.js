import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import crypto from 'crypto';
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
        relatedOrderId: order.id,
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
      where: { key: { in: ['site_name', 'support_phone', 'support_email', 'copyright', 'hero_title', 'hero_subtitle', 'sales_contact_title', 'sales_contact_text', 'sales_contact_phone', 'sales_contact_wechat', 'sales_contact_qr_url', 'sales_contact_phone_enabled', 'sales_contact_wechat_enabled', 'sales_contact_email_enabled', 'sales_contact_telegram_enabled', 'sales_contact_qr_enabled', 'sales_contact_telegram', 'sales_contact_telegram_url'] } }
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

  app.post('/api/admin/auth/change-password', requireAdmin, asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) return fail(res, 40031, '新密码至少 6 位');
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    if (!admin || !(await bcrypt.compare(currentPassword || '', admin.passwordHash))) return fail(res, 40114, '当前密码错误', 401);
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(String(newPassword), 12) }
    });
    await logOperation(req, 'change_admin_password', 'admin', admin.id);
    ok(res, { changed: true });
  }));

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
    if (req.user.balance < amount) return fail(res, 40013, '余额不足，请先充值');
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
    ok(res, await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        product: true,
        server: true,
        openedServer: {
          select: {
            id: true,
            name: true,
            ip: true,
            os: true,
            status: true,
            expiresAt: true,
            orderId: true,
            product: true
          }
        },
        notifications: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    }));
  }));

  app.get('/api/client/servers', requireUser, asyncRoute(async (req, res) => {
    const servers = await prisma.server.findMany({
      where: { userId: req.user.id, deletedAt: null },
      include: {
        product: true,
        order: { include: { notifications: { orderBy: { createdAt: 'desc' } } } },
        orders: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    ok(res, servers.map((server) => serializeServer(server, true)));
  }));

  app.get('/api/client/servers/:id', requireUser, asyncRoute(async (req, res) => {
    const server = await prisma.server.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { product: true, order: true, orders: { orderBy: { createdAt: 'desc' } } } });
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
    ok(res, await prisma.notification.findMany({ where: { userId: req.user.id }, include: { order: true }, orderBy: { createdAt: 'desc' } }));
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
    ok(res, await prisma.user.findMany({
      include: { _count: { select: { orders: true, servers: true, tickets: true, notifications: true } } },
      orderBy: { createdAt: 'desc' }
    }));
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
    ok(res, await prisma.order.findMany({
      include: {
        user: true,
        product: true,
        server: true,
        notifications: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    }));
  }));

  app.get('/api/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true, product: true, server: true, walletLogs: true, renewals: true, notifications: true } });
    if (!order) return fail(res, 40406, '订单不存在', 404);
    ok(res, order);
  }));

  app.post('/api/admin/orders/:id/message', requireAdmin, asyncRoute(async (req, res) => {
    const content = String(req.body.content || '').trim();
    if (!content) return fail(res, 40054, '消息内容必填');
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true, product: true } });
    if (!order) return fail(res, 40406, '订单不存在', 404);
    const notification = await prisma.notification.create({
      data: {
        userId: order.userId,
        relatedOrderId: order.id,
        type: 'order_message',
        title: `订单通知：${order.orderNo}`,
        content
      }
    });
    await logOperation(req, 'send_order_message', 'order', order.id, { notificationId: notification.id });
    ok(res, notification);
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
    if (!req.body.confirm) {
      return fail(res, 40055, '请确认退款操作');
    }
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
        relatedOrderId: order?.id,
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
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        type: 'ticket_reply',
        title: `工单回复：${ticket.title}`,
        content: req.body.content
      }
    });
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

  app.get('/api/fastmos/servers', asyncRoute(async (req, res) => {
    const baseUrl = 'https://www.fastmos.com/host/get_data/get_buy_info';
    const params = new URLSearchParams({
      area_id: req.query.area_id || '0',
      server_id: req.query.server_id || '0',
      parent_id: req.query.parent_id || '0',
      buy_type: req.query.buy_type || 'rent',
      netline_id: req.query.netline_id || '0',
      coupon_id: req.query.coupon_id || '0',
      type: req.query.type || '',
      use_point: req.query.use_point || '',
      no_use_activity: req.query.no_use_activity || '0'
    });
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    const text = await response.text();
    try {
      const upstream = JSON.parse(text);
      if (upstream.code !== 0) {
        return res.json({ code: upstream.code || 500, message: upstream.message || 'Fastmos 接口错误', data: null });
      }
      const { code: _code, ...data } = upstream;
      ok(res, data);
    } catch {
      res.status(502).json({ code: 502, message: '上游接口返回异常', data: null });
    }
  }));

  // ── Upstream Sync ──

  const FASTMOS_BASE = 'https://www.fastmos.com/host/get_data/get_buy_info';

  async function ensureFastmosSource() {
    let source = await prisma.upstreamSource.findFirst({ where: { name: 'Fastmos' } });
    if (!source) {
      source = await prisma.upstreamSource.create({
        data: {
          name: 'Fastmos',
          apiUrl: FASTMOS_BASE,
          defaultParams: JSON.stringify({ area_id: '0', server_id: '0', parent_id: '0', buy_type: 'rent', netline_id: '0' }),
          status: 'active'
        }
      });
    }
    return source;
  }

  function stripHtml(html) {
    if (!html) return '';
    return String(html).replace(/<[^>]*>/g, '').trim();
  }

  function normHash(server, areaGroup, netlineNames) {
    const cfg = server.server_config || {};
    const price = server.price_show || '';
    const raw = [
      server.title || '',
      areaGroup,
      cfg.cpus_sn || '',
      String(cfg.cpus || 1),
      String(cfg.mem_start || 0),
      String(cfg.disk || 0),
      String(cfg.disk_num || 1),
      cfg.disk_sn || '',
      String(cfg.net || 0),
      stripHtml(cfg.net_desc || ''),
      cfg.def || '',
      price,
      String(server.stock ?? ''),
      String(server.status || ''),
      netlineNames
    ].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  function parsePriceCents(priceShow) {
    if (!priceShow) return null;
    const num = parseFloat(String(priceShow).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) ? Math.round(num * 100) : null;
  }

  // Returns { childAreaMap, parentNameByChildId, areaNetlineMap }
  // - childAreaMap: childId → { name, parentId, netlineIds[] }
  // - parentNameByChildId: childId → parentName
  // - areaNetlineMap: areaId → netline name string
  function buildAreaMaps(areaList, childAreaList, netlineList) {
    // Build parent map (parent_id === '0')
    const parentMap = {};
    for (const a of (areaList || [])) {
      if (String(a.parent_id || a.parent_id) === '0') {
        parentMap[String(a.id)] = a.name || '';
      }
    }

    // Build child area map
    const childAreaMap = {};
    const parentNameByChildId = {};
    for (const a of (childAreaList || [])) {
      const childId = String(a.id);
      const parentId = String(a.parent_id || '0');
      childAreaMap[childId] = {
        name: a.name || '',
        parentId,
        netlineIds: (a.netline_ids || '').split(',').map((s) => s.trim()).filter(Boolean)
      };
      // Look up parent name
      const parentName = parentMap[parentId] || '';
      if (parentName) {
        parentNameByChildId[childId] = parentName;
      }
    }

    // Build netline map
    const netlineNameById = {};
    if (netlineList) {
      if (Array.isArray(netlineList)) {
        for (const n of netlineList) {
          netlineNameById[String(n.id)] = n.name || '';
        }
      } else {
        for (const [id, n] of Object.entries(netlineList)) {
          netlineNameById[String(id)] = n.name || '';
        }
      }
    }

    // Build area→netline names
    const areaNetlineMap = {};
    for (const [childId, child] of Object.entries(childAreaMap)) {
      const names = child.netlineIds.map((nid) => netlineNameById[nid] || '').filter(Boolean);
      areaNetlineMap[childId] = names.join('/');
    }

    return { childAreaMap, parentNameByChildId, areaNetlineMap };
  }

  async function fetchFastmosOne(areaId = '0', parentId = '0', netlineId = '0') {
    const params = new URLSearchParams({
      area_id: areaId, server_id: '0', parent_id: parentId,
      buy_type: 'rent', netline_id: netlineId, coupon_id: '0',
      type: '', use_point: '', no_use_activity: '0'
    });
    const response = await fetch(`${FASTMOS_BASE}?${params.toString()}`, {
      headers: { 'Accept': 'application/json, text/javascript, */*', 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!response.ok) throw new Error(`Fastmos 返回 HTTP ${response.status} (area=${areaId})`);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Fastmos 接口返回非 JSON 数据 (area=${areaId})`);
    }
    if (data.code !== 0) throw new Error(`Fastmos 接口错误 (area=${areaId}): ${data.message || data.code}`);
    return data;
  }

  async function fetchFastmosAll() {
    // Step 1: get area catalog and default region servers
    const catalog = await fetchFastmosOne('0', '0', '0');

    // Identify parent areas (parent_id === '0' and status === '1')
    const parentAreas = (catalog.area_list || []).filter(
      (a) => String(a.parent_id || '0') === '0' && String(a.status || '1') === '1'
    );

    // Track all servers, child areas, and netlines
    const allServers = [...(catalog.server_list || [])];
    const seenServerIds = new Set(allServers.map((s) => String(s.id)));
    const allChildAreas = [...(catalog.child_area_list || [])];
    const seenChildIds = new Set(allChildAreas.map((c) => String(c.id)));
    const allNetlineLists = { ...(catalog.netline_list || {}) };

    // Step 2: iterate each parent area to discover child areas and first-child servers
    for (const parent of parentAreas) {
      try {
        const data = await fetchFastmosOne(parent.id, '0', '0');

        // Merge child areas
        for (const child of (data.child_area_list || [])) {
          const cid = String(child.id);
          if (!seenChildIds.has(cid)) {
            seenChildIds.add(cid);
            allChildAreas.push(child);
          }
        }

        // Merge servers from this parent call
        for (const server of (data.server_list || [])) {
          const sid = String(server.id);
          if (!seenServerIds.has(sid)) {
            seenServerIds.add(sid);
            allServers.push(server);
          }
        }

        // Merge netline lists
        if (data.netline_list) {
          if (Array.isArray(data.netline_list)) {
            for (const n of data.netline_list) {
              allNetlineLists[String(n.id)] = n;
            }
          } else {
            Object.assign(allNetlineLists, data.netline_list);
          }
        }
      } catch (err) {
        console.warn(`Fastmos sync: skipping parent area ${parent.id} (${parent.name}): ${err.message}`);
      }
    }

    // Step 3: iterate each child area to get all servers per variant
    for (const child of allChildAreas) {
      // Skip child areas that are unlikely to have servers
      if (String(child.status || '1') !== '1') continue;

      try {
        const data = await fetchFastmosOne(child.id, child.parent_id || '0', '0');

        // Merge servers
        for (const server of (data.server_list || [])) {
          const sid = String(server.id);
          if (!seenServerIds.has(sid)) {
            seenServerIds.add(sid);
            allServers.push(server);
          }
        }

        // Merge any new netlines
        if (data.netline_list) {
          if (Array.isArray(data.netline_list)) {
            for (const n of data.netline_list) {
              if (!allNetlineLists[String(n.id)]) {
                allNetlineLists[String(n.id)] = n;
              }
            }
          } else {
            for (const [k, v] of Object.entries(data.netline_list)) {
              if (!allNetlineLists[k]) allNetlineLists[k] = v;
            }
          }
        }
      } catch (err) {
        console.warn(`Fastmos sync: skipping child area ${child.id} (${child.name}): ${err.message}`);
      }
    }

    return {
      area_list: catalog.area_list,
      child_area_list: allChildAreas,
      server_list: allServers,
      netline_list: allNetlineLists
    };
  }

  // ── Reusable sync function (used by admin API and auto-startup) ──

  let _syncing = false;

  async function syncLog(runId, level, step, message, meta = null) {
    try {
      await prisma.upstreamSyncLog.create({
        data: { runId, level, step, message, meta: meta ? JSON.stringify(meta) : null }
      });
    } catch (_) { /* log failure shouldn't break sync */ }
  }

  async function syncFastmosProducts() {
    const source = await ensureFastmosSource();
    const run = await prisma.upstreamSyncRun.create({
      data: { sourceId: source.id, status: 'running', startedAt: new Date() }
    });
    return syncFastmosProductsWithRun(run.id, source.id);
  }

  async function syncFastmosProductsWithRun(runId, sourceId) {
    const source = await prisma.upstreamSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error('上游数据源不存在');
    const t0 = Date.now();

    const log = (level, step, msg, meta) => syncLog(runId, level, step, msg, meta);

    try {
      await log('info', 'start', '开始同步 Fastmos 上游数据');

      // Step 1: catalog
      await log('info', 'catalog', '获取初始目录...');
      const catalog = await fetchFastmosOne('0', '0', '0');
      const parentAreas = (catalog.area_list || []).filter(
        (a) => String(a.parent_id || '0') === '0' && String(a.status || '1') === '1'
      );
      await log('info', 'catalog', `获取目录完成：${parentAreas.length} 个产品组，初始 ${(catalog.server_list || []).length} 台服务器`);

      const allServers = [...(catalog.server_list || [])];
      const seenServerIds = new Set(allServers.map((s) => String(s.id)));
      const allChildAreas = [...(catalog.child_area_list || [])];
      const seenChildIds = new Set(allChildAreas.map((c) => String(c.id)));
      const allNetlineLists = { ...(catalog.netline_list || {}) };

      // Step 2: iterate parent areas
      for (const parent of parentAreas) {
        const pt0 = Date.now();
        try {
          await log('info', 'parent_area', `拉取产品组: ${parent.name} (ID=${parent.id})`);
          const data = await fetchFastmosOne(parent.id, '0', '0');
          const childCount = (data.child_area_list || []).length;
          const srvCount = (data.server_list || []).length;

          for (const child of (data.child_area_list || [])) {
            const cid = String(child.id);
            if (!seenChildIds.has(cid)) { seenChildIds.add(cid); allChildAreas.push(child); }
          }
          for (const server of (data.server_list || [])) {
            const sid = String(server.id);
            if (!seenServerIds.has(sid)) { seenServerIds.add(sid); allServers.push(server); }
          }
          if (data.netline_list) Object.assign(allNetlineLists, data.netline_list || {});

          await log('info', 'parent_area', `产品组 ${parent.name} 完成：${srvCount} 台，${childCount} 子区域，${Date.now() - pt0}ms`);
        } catch (err) {
          await log('warn', 'parent_area', `产品组 ${parent.name} 失败: ${err.message}`);
        }
      }

      // Step 3: iterate child areas
      for (const child of allChildAreas) {
        if (String(child.status || '1') !== '1') continue;
        const ct0 = Date.now();
        try {
          await log('info', 'child_area', `拉取线路: ${child.name} (ID=${child.id})`);
          const data = await fetchFastmosOne(child.id, child.parent_id || '0', '0');
          const srvCount = (data.server_list || []).length;
          for (const server of (data.server_list || [])) {
            const sid = String(server.id);
            if (!seenServerIds.has(sid)) { seenServerIds.add(sid); allServers.push(server); }
          }
          await log('info', 'child_area', `线路 ${child.name} 完成：${srvCount} 台，${Date.now() - ct0}ms`);
        } catch (err) {
          await log('warn', 'child_area', `线路 ${child.name} 失败: ${err.message}`);
        }
      }

      // Step 4: write to DB
      await log('info', 'db_write', `开始写入数据库：${allServers.length} 台服务器`);
      const { childAreaMap, parentNameByChildId, areaNetlineMap } = buildAreaMaps(
        catalog.area_list, allChildAreas, allNetlineLists
      );
      const servers = allServers;
      const currentUpstreamIds = new Set();
      let newCount = 0, changedCount = 0;

      for (const server of servers) {
        const upstreamId = String(server.id);
        currentUpstreamIds.add(upstreamId);
        const cfg = server.server_config || {};
        const childId = String(server.default_area_id || '');
        const childInfo = childAreaMap[childId] || {};
        const areaGroup = parentNameByChildId[childId] || childInfo.name || null;
        const area = childInfo.name || null;
        const netline = areaNetlineMap[childId] || null;
        const priceMonthly = parsePriceCents(server.price_show);

        const entry = {
          sourceId: source.id, upstreamId, title: server.title || '',
          areaGroup, area, areaId: childId, netline,
          netDesc: stripHtml(cfg.net_desc || '') || null,
          cpu: cfg.cpus_sn || null, cpuCount: parseInt(cfg.cpus, 10) || null,
          memory: cfg.mem_start ? `${cfg.mem_start}MB` : null,
          disk: cfg.disk ? `${cfg.disk}GB` : null,
          diskNum: parseInt(cfg.disk_num, 10) || null, diskSn: cfg.disk_sn || null,
          bandwidth: cfg.net ? `${cfg.net}M` : null, defense: cfg.def || null,
          priceMonthly, priceShow: server.price_show || null,
          priceConfig: server.price_config ? JSON.stringify(server.price_config) : null,
          stock: parseInt(server.stock, 10) || 0,
          status: server.status === '1' || server.on_sale === '1' ? 'on_sale' : 'off_sale',
          sortOrder: parseInt(server.sort, 10) || 0,
          rawJson: JSON.stringify(server),
          normHash: normHash(server, areaGroup, netline)
        };

        const existing = await prisma.upstreamServerProduct.findUnique({
          where: { sourceId_upstreamId: { sourceId: source.id, upstreamId } }
        });
        if (!existing) { await prisma.upstreamServerProduct.create({ data: entry }); newCount++; }
        else if (existing.normHash !== entry.normHash) {
          await prisma.upstreamServerProduct.update({ where: { id: existing.id }, data: { ...entry, published: existing.published, productId: existing.productId } });
          changedCount++;
        } else {
          await prisma.upstreamServerProduct.update({ where: { id: existing.id }, data: { stock: entry.stock, netDesc: entry.netDesc, status: entry.status, priceMonthly: entry.priceMonthly, priceShow: entry.priceShow, sortOrder: entry.sortOrder, rawJson: entry.rawJson } });
        }
      }

      const allExisting = await prisma.upstreamServerProduct.findMany({ where: { sourceId: source.id } });
      let offlineCount = 0;
      for (const p of allExisting) {
        if (!currentUpstreamIds.has(p.upstreamId) && p.status !== 'offline') {
          await prisma.upstreamServerProduct.update({ where: { id: p.id }, data: { status: 'offline' } });
          offlineCount++;
        }
      }

      const endedAt = new Date();
      await prisma.upstreamSyncRun.update({
        where: { id: runId },
        data: { status: 'success', endedAt, fetchedCount: servers.length, newCount, changedCount, offlineCount }
      });
      await prisma.upstreamSource.update({ where: { id: source.id }, data: { lastSyncAt: endedAt } });

      const totalMs = Date.now() - t0;
      await log('info', 'complete', `同步完成：${servers.length} 台，新增 ${newCount}，变更 ${changedCount}，下架 ${offlineCount}，总耗时 ${(totalMs / 1000).toFixed(1)}s`);

      return { runId, fetched: servers.length, new: newCount, changed: changedCount, offline: offlineCount };
    } catch (error) {
      await log('error', 'fail', `同步失败: ${error.message}`);
      await prisma.upstreamSyncRun.update({
        where: { id: runId },
        data: { status: 'failed', endedAt: new Date(), errorMessage: error.message, errorCount: 1 }
      });
      throw error;
    }
  }

  app.post('/api/admin/upstream/fastmos/sync', requireAdmin, (_req, res) => {
    res.status(410).json({ code: 410, message: '旧同步接口已废弃，请使用 POST /api/admin/upstream/fastmos/fetch-preview', data: null });
  });

  app.get('/api/admin/upstream/fastmos/sync-runs', requireAdmin, asyncRoute(async (_req, res) => {
    const runs = await prisma.upstreamSyncRun.findMany({
      orderBy: { startedAt: 'desc' }, take: 20
    });
    ok(res, runs);
  }));

  app.get('/api/admin/upstream/fastmos/sync-runs/:runId/logs', requireAdmin, asyncRoute(async (req, res) => {
    const logs = await prisma.upstreamSyncLog.findMany({
      where: { runId: req.params.runId },
      orderBy: { createdAt: 'asc' }
    });
    ok(res, logs);
  }));

  app.get('/api/admin/upstream/fastmos/sync-current', requireAdmin, asyncRoute(async (_req, res) => {
    const current = await prisma.upstreamSyncRun.findFirst({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' }
    });
    if (!current) return ok(res, null);
    const logs = await prisma.upstreamSyncLog.findMany({
      where: { runId: current.id },
      orderBy: { createdAt: 'desc' }, take: 50
    });
    ok(res, { run: current, logs: logs.reverse(), syncing: _syncing });
  }));

  app.get('/api/admin/upstream/fastmos/products', requireAdmin, asyncRoute(async (_req, res) => {
    const source = await prisma.upstreamSource.findFirst({ where: { name: 'Fastmos' } });
    if (!source) return ok(res, []);
    const products = await prisma.upstreamServerProduct.findMany({
      where: { sourceId: source.id },
      include: { product: true },
      orderBy: [{ areaGroup: 'asc' }, { sortOrder: 'asc' }]
    });
    ok(res, products);
  }));

  app.get('/api/admin/upstream/fastmos/diff', requireAdmin, asyncRoute(async (_req, res) => {
    const source = await prisma.upstreamSource.findFirst({ where: { name: 'Fastmos' } });
    if (!source) return ok(res, { new: [], changed: [], offline: [], unchanged: [], localOnly: [] });

    const upstreamProducts = await prisma.upstreamServerProduct.findMany({
      where: { sourceId: source.id },
      include: { product: true }
    });

    const newItems = upstreamProducts.filter((p) => !p.productId && p.status === 'on_sale');
    const changedItems = upstreamProducts.filter((p) => p.productId && p.status === 'on_sale' && !p.published);
    const offlineItems = upstreamProducts.filter((p) => p.status === 'offline' && p.productId);
    const unchangedItems = upstreamProducts.filter((p) => p.productId && p.published);
    const localOnly = await prisma.product.findMany({
      where: { upstreamProduct: null },
      include: { orders: { select: { id: true } }, servers: { select: { id: true } } }
    });

    ok(res, { new: newItems, changed: changedItems, offline: offlineItems, unchanged: unchangedItems, localOnly });
  }));

  app.post('/api/admin/upstream/fastmos/merge', requireAdmin, asyncRoute(async (req, res) => {
    const { action, upstreamIds } = req.body;
    if (!action || !upstreamIds || !Array.isArray(upstreamIds)) {
      return fail(res, 40060, '请提供 action 和 upstreamIds 数组');
    }

    const source = await prisma.upstreamSource.findFirst({ where: { name: 'Fastmos' } });
    if (!source) return fail(res, 40407, '上游数据源不存在', 404);

    const results = { created: 0, updated: 0, ignored: 0, offlined: 0 };

    for (const upstreamId of upstreamIds) {
      const usp = await prisma.upstreamServerProduct.findUnique({
        where: { sourceId_upstreamId: { sourceId: source.id, upstreamId: String(upstreamId) } }
      });
      if (!usp) continue;

      if (action === 'create') {
        const productData = {
          name: usp.title || `${usp.areaGroup || ''} ${usp.cpu || ''}`.trim(),
          type: '服务器租用',
          location: usp.areaGroup || usp.area || '',
          cpu: `${usp.cpu || '-'}${usp.cpuCount ? ` x ${usp.cpuCount}` : ''}`,
          memory: usp.memory || '-',
          disk: `${usp.disk || '-'}${usp.diskNum ? ` x ${usp.diskNum}` : ''} ${usp.diskSn || ''}`.trim(),
          bandwidth: usp.bandwidth || '-',
          defense: usp.defense || '-',
          priceMonthly: usp.priceMonthly || 0,
          priceYearly: usp.priceMonthly ? usp.priceMonthly * 10 : 0,
          stock: usp.stock || 0,
          status: 'on_sale',
          sortOrder: usp.sortOrder || 0
        };
        const product = await prisma.product.create({ data: productData });
        await prisma.upstreamServerProduct.update({
          where: { id: usp.id },
          data: { productId: product.id, published: true }
        });
        results.created++;
      } else if (action === 'update') {
        if (!usp.productId) continue;
        await prisma.product.update({
          where: { id: usp.productId },
          data: {
            name: usp.title || undefined,
            cpu: `${usp.cpu || '-'}${usp.cpuCount ? ` x ${usp.cpuCount}` : ''}`,
            memory: usp.memory || '-',
            disk: `${usp.disk || '-'}${usp.diskNum ? ` x ${usp.diskNum}` : ''} ${usp.diskSn || ''}`.trim(),
            bandwidth: usp.bandwidth || '-',
            defense: usp.defense || '-',
            priceMonthly: usp.priceMonthly || 0,
            priceYearly: usp.priceMonthly ? usp.priceMonthly * 10 : 0,
            stock: usp.stock || 0,
            status: usp.status === 'on_sale' ? 'on_sale' : 'off_sale'
          }
        });
        await prisma.upstreamServerProduct.update({
          where: { id: usp.id },
          data: { published: true }
        });
        results.updated++;
      } else if (action === 'ignore') {
        await prisma.upstreamServerProduct.update({
          where: { id: usp.id },
          data: { published: true }
        });
        results.ignored++;
      } else if (action === 'offline') {
        if (usp.productId) {
          const orderCount = await prisma.order.count({ where: { productId: usp.productId } });
          if (orderCount > 0) {
            await prisma.product.update({ where: { id: usp.productId }, data: { status: 'off_sale' } });
          } else {
            await prisma.product.delete({ where: { id: usp.productId } });
          }
        }
        await prisma.upstreamServerProduct.update({
          where: { id: usp.id },
          data: { status: 'offline', published: false, productId: null }
        });
        results.offlined++;
      }
    }

    await logOperation(req, 'upstream_merge', 'upstream_source', source.id, { action, count: upstreamIds.length, ...results });
    ok(res, results);
  }));

  // ── Clear all products (dangerous, requires password) ──

  app.post('/api/admin/products/clear-all', requireAdmin, asyncRoute(async (req, res) => {
    const { password, confirmText, scope } = req.body;
    if (confirmText !== 'CLEAR_PRODUCTS') return fail(res, 40090, '确认文本不正确，请输入 CLEAR_PRODUCTS');
    if (!password) return fail(res, 40091, '请输入管理员密码');

    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      await logOperation(req, 'clear_products_failed_wrong_password', 'product', null, {});
      return fail(res, 40115, '管理员密码错误', 401);
    }

    let deleted = 0, archived = 0, skipped = 0;
    const products = await prisma.product.findMany({ include: { orders: { select: { id: true } }, servers: { select: { id: true } } } });

    for (const p of products) {
      if (p.orders.length > 0 || p.servers.length > 0) {
        if (p.status !== 'off_sale') {
          await prisma.product.update({ where: { id: p.id }, data: { status: 'off_sale' } });
          archived++;
        } else { skipped++; }
      } else {
        await prisma.product.delete({ where: { id: p.id } });
        deleted++;
      }
    }

    await logOperation(req, 'clear_all_products', 'product', null, { deleted, archived, skipped, scope });
    ok(res, { deleted, archived, skipped });
  }));

  // ── Fetch-preview (phase A: fetch upstream, store to preview table) ──

  app.post('/api/admin/upstream/fastmos/fetch-preview', requireAdmin, asyncRoute(async (req, res) => {
    if (_syncing) {
      const current = await prisma.upstreamSyncRun.findFirst({ where: { status: 'running' }, orderBy: { startedAt: 'desc' } });
      return ok(res, { runId: current?.id, status: 'running', alreadyRunning: true });
    }
    const source = await ensureFastmosSource();
    const run = await prisma.upstreamSyncRun.create({ data: { sourceId: source.id, status: 'running', startedAt: new Date() } });
    _syncing = true;

    // Background: fetch upstream data and store to preview table
    (async () => {
      const runId = run.id;
      const log = (level, step, msg) => prisma.upstreamSyncLog.create({ data: { runId, level, step, message: msg } }).catch(() => {});
      try {
        await log('info', 'start', '开始获取上游数据预览');
        const upstream = await fetchFastmosAll();
        const { childAreaMap, parentNameByChildId, areaNetlineMap } = buildAreaMaps(upstream.area_list, upstream.child_area_list, upstream.netline_list);
        const servers = upstream.server_list || [];
        const upstreamIds = new Set();

        let newCount = 0, changedCount = 0, unchangedCount = 0, offlineCount = 0;

        // Upsert preview records
        for (const server of servers) {
          const upstreamId = String(server.id);
          upstreamIds.add(upstreamId);
          const cfg = server.server_config || {};
          const childId = String(server.default_area_id || '');
          const childInfo = childAreaMap[childId] || {};
          const areaGroup = parentNameByChildId[childId] || childInfo.name || null;
          const area = childInfo.name || null;
          const netline = areaNetlineMap[childId] || null;
          const hash = normHash(server, areaGroup, netline);

          const existing = await prisma.upstreamServerProduct.findUnique({ where: { sourceId_upstreamId: { sourceId: source.id, upstreamId } } });
          let action = 'new';
          if (existing) {
            action = existing.normHash !== hash ? 'changed' : 'unchanged';
          }

          const previewData = {
            runId, sourceId: source.id, upstreamId,
            action, title: server.title || '',
            areaGroup, area, areaId: childId, netline,
            cpu: cfg.cpus_sn || null, cpuCount: parseInt(cfg.cpus, 10) || null,
            memory: cfg.mem_start ? `${cfg.mem_start}MB` : null,
            disk: cfg.disk ? `${cfg.disk}GB` : null,
            diskNum: parseInt(cfg.disk_num, 10) || null, diskSn: cfg.disk_sn || null,
            bandwidth: cfg.net ? `${cfg.net}M` : null, defense: cfg.def || null,
            priceMonthly: parsePriceCents(server.price_show),
            priceShow: server.price_show || null,
            stock: parseInt(server.stock, 10) || 0,
            status: server.status === '1' || server.on_sale === '1' ? 'on_sale' : 'off_sale',
            sortOrder: parseInt(server.sort, 10) || 0,
            payloadJson: JSON.stringify(server),
            diffJson: existing ? JSON.stringify({ oldHash: existing.normHash, newHash: hash }) : null,
            normHash: hash,
            existingProductId: existing?.productId || null, applied: false
          };

          await prisma.upstreamSyncPreview.upsert({
            where: { runId_upstreamId: { runId, upstreamId } },
            create: previewData,
            update: { ...previewData, applied: false }
          });

          if (action === 'new') newCount++;
          else if (action === 'changed') changedCount++;
          else unchangedCount++;
        }

        // Mark offline: products that exist in UpstreamServerProduct but not in this fetch
        const allExisting = await prisma.upstreamServerProduct.findMany({ where: { sourceId: source.id } });
        for (const p of allExisting) {
          if (!upstreamIds.has(p.upstreamId) && p.status !== 'offline') {
            await prisma.upstreamSyncPreview.create({
              data: {
                runId, sourceId: source.id, upstreamId: p.upstreamId,
                action: 'offline', title: p.title,
                areaGroup: p.areaGroup, area: p.area, areaId: p.areaId, netline: p.netline,
                cpu: p.cpu, cpuCount: p.cpuCount, memory: p.memory, disk: p.disk,
                diskNum: p.diskNum, diskSn: p.diskSn, bandwidth: p.bandwidth, defense: p.defense,
                priceMonthly: p.priceMonthly, priceShow: p.priceShow, stock: p.stock,
                status: p.status, sortOrder: p.sortOrder,
                payloadJson: p.rawJson || '',
                existingProductId: p.productId, applied: false
              }
            });
            offlineCount++;
          }
        }

        const endedAt = new Date();
        await prisma.upstreamSyncRun.update({ where: { id: runId }, data: { status: 'pending_review', endedAt, fetchedCount: servers.length, newCount, changedCount, offlineCount } });
        await log('info', 'complete', `预览获取完成：${servers.length} 台，新增${newCount}，变更${changedCount}，不变${unchangedCount}，下线${offlineCount}`);
      } catch (err) {
        await log('error', 'fail', `预览获取失败: ${err.message}`);
        await prisma.upstreamSyncRun.update({ where: { id: runId }, data: { status: 'failed', endedAt: new Date(), errorMessage: err.message, errorCount: 1 } });
      } finally { _syncing = false; }
    })();

    await logOperation(req, 'fetch_preview_start', 'upstream_source', source.id, { runId: run.id });
    ok(res, { runId: run.id, status: 'running' });
  }));

  // ── Preview listing (phase B) ──
  app.get('/api/admin/upstream/fastmos/sync-runs/:runId/preview', requireAdmin, asyncRoute(async (req, res) => {
    const { action, keyword, page, pageSize } = req.query;
    const where = { runId: req.params.runId };
    if (action) where.action = action;
    let items = await prisma.upstreamSyncPreview.findMany({ where, orderBy: { createdAt: 'asc' } });
    if (keyword) {
      const q = keyword.toLowerCase();
      items = items.filter(p => (p.title || '').toLowerCase().includes(q) || (p.cpu || '').toLowerCase().includes(q) || (p.areaGroup || '').toLowerCase().includes(q));
    }
    ok(res, items);
  }));

  // ── Apply preview to formal products (phase C) ──
  app.post('/api/admin/upstream/fastmos/sync-runs/:runId/apply', requireAdmin, asyncRoute(async (req, res) => {
    const { previewIds, applyMode } = req.body;
    const source = await ensureFastmosSource();
    const runId = req.params.runId;

    let previews;
    if (applyMode === 'all_new_changed') {
      previews = await prisma.upstreamSyncPreview.findMany({ where: { runId, action: { in: ['new', 'changed'] }, applied: false } });
    } else if (previewIds && previewIds.length > 0) {
      previews = await prisma.upstreamSyncPreview.findMany({ where: { id: { in: previewIds }, runId, applied: false } });
    } else {
      return fail(res, 40092, '请选择要应用的预览项');
    }

    let applied = 0, failed = 0;
    for (const pv of previews) {
      try {
        if (pv.action === 'new') {
          await prisma.upstreamServerProduct.create({
            data: {
              sourceId: source.id, upstreamId: pv.upstreamId, title: pv.title || '',
              areaGroup: pv.areaGroup, area: pv.area, areaId: pv.areaId, netline: pv.netline,
              cpu: pv.cpu, cpuCount: pv.cpuCount, memory: pv.memory, disk: pv.disk,
              diskNum: pv.diskNum, diskSn: pv.diskSn, bandwidth: pv.bandwidth, defense: pv.defense,
              priceMonthly: pv.priceMonthly, priceShow: pv.priceShow, stock: pv.stock,
              status: pv.status || 'on_sale', sortOrder: pv.sortOrder, normHash: pv.normHash,
              rawJson: pv.payloadJson || '', published: false
            }
          });
        } else if (pv.action === 'changed') {
          await prisma.upstreamServerProduct.upsert({
            where: { sourceId_upstreamId: { sourceId: source.id, upstreamId: pv.upstreamId } },
            create: {
              sourceId: source.id, upstreamId: pv.upstreamId, title: pv.title || '',
              areaGroup: pv.areaGroup, area: pv.area, areaId: pv.areaId, netline: pv.netline,
              cpu: pv.cpu, cpuCount: pv.cpuCount, memory: pv.memory, disk: pv.disk,
              diskNum: pv.diskNum, diskSn: pv.diskSn, bandwidth: pv.bandwidth, defense: pv.defense,
              priceMonthly: pv.priceMonthly, priceShow: pv.priceShow, stock: pv.stock,
              status: pv.status || 'on_sale', sortOrder: pv.sortOrder, normHash: pv.normHash,
              rawJson: pv.payloadJson || '', published: false
            },
            update: {
              title: pv.title || undefined, areaGroup: pv.areaGroup, area: pv.area, areaId: pv.areaId, netline: pv.netline,
              cpu: pv.cpu, cpuCount: pv.cpuCount, memory: pv.memory, disk: pv.disk,
              diskNum: pv.diskNum, diskSn: pv.diskSn, bandwidth: pv.bandwidth, defense: pv.defense,
              priceMonthly: pv.priceMonthly, priceShow: pv.priceShow, stock: pv.stock,
              status: pv.status || 'on_sale', sortOrder: pv.sortOrder, normHash: pv.normHash,
              rawJson: pv.payloadJson || ''
            }
          });
        }
        await prisma.upstreamSyncPreview.update({ where: { id: pv.id }, data: { applied: true } });
        applied++;
      } catch (e) {
        failed++;
        await prisma.upstreamSyncLog.create({ data: { runId, level: 'error', step: 'apply', message: `应用 ${pv.upstreamId} 失败: ${e.message}` } }).catch(() => {});
      }
    }

    const run = await prisma.upstreamSyncRun.findUnique({ where: { id: runId } });
    if (run && run.status === 'pending_review') {
      const remaining = await prisma.upstreamSyncPreview.count({ where: { runId, applied: false } });
      if (remaining === 0) {
        await prisma.upstreamSyncRun.update({ where: { id: runId }, data: { status: 'applied' } });
      }
    }

    await logOperation(req, 'apply_preview', 'upstream_source', source.id, { runId, applied, failed });
    ok(res, { applied, failed });
  }));

  // ── Upstream product CRUD ──

  app.get('/api/admin/upstream/fastmos/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const product = await prisma.upstreamServerProduct.findUnique({
      where: { id: req.params.id },
      include: { product: true }
    });
    if (!product) return fail(res, 40408, '上游产品不存在', 404);
    ok(res, product);
  }));

  app.post('/api/admin/upstream/fastmos/products', requireAdmin, asyncRoute(async (req, res) => {
    const source = await ensureFastmosSource();
    const { title, areaGroup, area, areaId, netline, netDesc, cpu, cpuCount, memory, disk, diskNum, diskSn, bandwidth, defense, priceMonthly, priceShow, stock, status: ustStatus, sortOrder } = req.body;
    if (!title) return fail(res, 40080, '标题必填');

    // Compute upstreamId for manual entries
    const upstreamId = req.body.upstreamId || `manual-${Date.now()}`;
    const existing = await prisma.upstreamServerProduct.findUnique({
      where: { sourceId_upstreamId: { sourceId: source.id, upstreamId } }
    });
    if (existing) return fail(res, 40081, `上游ID "${upstreamId}" 已存在`);

    const normFields = [title, areaGroup || '', cpu || '', String(cpuCount || 1), memory || '', disk || '', String(diskNum || 1), diskSn || '', bandwidth || '', netDesc || '', priceShow || '', String(stock ?? ''), ustStatus || 'on_sale', netline || ''];
    const normHash = crypto.createHash('sha256').update(normFields.join('|')).digest('hex').slice(0, 16);

    const product = await prisma.upstreamServerProduct.create({
      data: {
        sourceId: source.id, upstreamId, title, areaGroup: areaGroup || null, area: area || null,
        areaId: areaId || null, netline: netline || null, netDesc: netDesc || null,
        cpu: cpu || null, cpuCount: parseInt(cpuCount, 10) || null,
        memory: memory || null, disk: disk || null, diskNum: parseInt(diskNum, 10) || null,
        diskSn: diskSn || null, bandwidth: bandwidth || null, defense: defense || null,
        priceMonthly: priceMonthly ? parseInt(priceMonthly, 10) : null, priceShow: priceShow || null,
        stock: stock != null ? parseInt(stock, 10) : 0,
        status: ustStatus || 'on_sale', sortOrder: parseInt(sortOrder, 10) || 0,
        normHash, rawJson: JSON.stringify({ manual: true, createdAt: new Date().toISOString() })
      }
    });
    await logOperation(req, 'create_upstream_product', 'upstream_product', product.id, { upstreamId });
    ok(res, product);
  }));

  app.put('/api/admin/upstream/fastmos/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const existing = await prisma.upstreamServerProduct.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, 40408, '上游产品不存在', 404);

    const data = {};
    const stringFields = ['title', 'areaGroup', 'area', 'areaId', 'netline', 'netDesc', 'cpu', 'memory', 'disk', 'diskSn', 'bandwidth', 'defense', 'priceShow', 'status'];
    for (const f of stringFields) {
      if (req.body[f] !== undefined) data[f] = req.body[f] || null;
    }
    const intFields = ['cpuCount', 'diskNum', 'priceMonthly', 'stock', 'sortOrder'];
    for (const f of intFields) {
      if (req.body[f] !== undefined) data[f] = parseInt(req.body[f], 10) || null;
    }

    // Recompute normHash
    const normFields = [data.title || existing.title, data.areaGroup || existing.areaGroup || '', data.cpu || existing.cpu || '', String(data.cpuCount ?? existing.cpuCount ?? 1), data.memory || existing.memory || '', data.disk || existing.disk || '', String(data.diskNum ?? existing.diskNum ?? 1), data.diskSn || existing.diskSn || '', data.bandwidth || existing.bandwidth || '', data.netDesc || existing.netDesc || '', data.priceShow || existing.priceShow || '', String(data.stock ?? existing.stock ?? ''), data.status || existing.status || 'on_sale', data.netline || existing.netline || ''];
    data.normHash = crypto.createHash('sha256').update(normFields.join('|')).digest('hex').slice(0, 16);

    const updated = await prisma.upstreamServerProduct.update({ where: { id: req.params.id }, data });
    await logOperation(req, 'update_upstream_product', 'upstream_product', updated.id, req.body);
    ok(res, updated);
  }));

  app.delete('/api/admin/upstream/fastmos/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const existing = await prisma.upstreamServerProduct.findUnique({
      where: { id: req.params.id }, include: { product: { include: { orders: { select: { id: true } } } } }
    });
    if (!existing) return fail(res, 40408, '上游产品不存在', 404);

    const action = req.body.action || 'offline';
    if (existing.productId && action !== 'force') {
      const orderCount = existing.product?.orders?.length || 0;
      return fail(res, 40082, `有关联产品(${orderCount}个订单)，建议"下架"或"解绑后删除"`, 409);
    }

    if (action === 'offline' || (existing.productId && action === 'unlink-delete')) {
      if (existing.productId) {
        await prisma.upstreamServerProduct.update({ where: { id: existing.id }, data: { productId: null, published: false } });
      }
      await prisma.upstreamServerProduct.update({ where: { id: existing.id }, data: { status: 'offline' } });
      await logOperation(req, 'offline_upstream_product', 'upstream_product', existing.id, { action });
      return ok(res, { action: 'offline', id: existing.id });
    }

    await prisma.upstreamServerProduct.delete({ where: { id: existing.id } });
    await logOperation(req, 'delete_upstream_product', 'upstream_product', existing.id, { upstreamId: existing.upstreamId });
    ok(res, { action: 'deleted', id: existing.id });
  }));

  // ── Public server products (published upstream products for frontend) ──

  app.get('/api/server-products', asyncRoute(async (_req, res) => {
    const source = await prisma.upstreamSource.findFirst({ where: { name: 'Fastmos' } });
    if (!source) return ok(res, { groups: [], areas: [], products: [], needsSync: true });

    const totalCount = await prisma.upstreamServerProduct.count({ where: { sourceId: source.id } });
    if (totalCount === 0) return ok(res, { groups: [], areas: [], products: [], needsSync: true });

    const upstreamProducts = await prisma.upstreamServerProduct.findMany({
      where: { sourceId: source.id, status: 'on_sale' },
      orderBy: [{ areaGroup: 'asc' }, { sortOrder: 'asc' }]
    });

    // Build grouped structure for tabs
    const groupSet = new Map();
    const areaSet = new Map();
    // Sort order for product groups
    const groupPriority = {
      '香港产品组': 1, '美国产品组': 2, '日本產品組': 3,
      '新加坡服务器': 4, '马来西亚服务器': 5, '韩国产品组': 6,
      '台湾产品组': 7, '東南亞產品組': 8, '站群服務器': 9,
      '宿主机产品组': 10, '显卡产品组': 11
    };
    const groupSort = (g) => groupPriority[g] || 99;

    const products = upstreamProducts.map((usp) => {
      const group = usp.areaGroup || '其他';
      const area = usp.area || '默认';
      const netline = usp.netline || '';

      if (!groupSet.has(group)) groupSet.set(group, { name: group, id: group });
      const areaKey = `${group}::${area}::${netline}`;
      if (!areaSet.has(areaKey)) areaSet.set(areaKey, { name: netline || area, id: areaKey, group, area, netline });

      return {
        id: usp.upstreamId,
        productId: usp.productId,
        published: usp.published,
        title: usp.title,
        areaGroup: group,
        area,
        areaKey,
        netline,
        netDesc: usp.netDesc,
        cpu: usp.cpu,
        cpuCount: usp.cpuCount,
        memory: usp.memory,
        disk: usp.disk,
        diskNum: usp.diskNum,
        diskSn: usp.diskSn,
        bandwidth: usp.bandwidth,
        defense: usp.defense,
        priceMonthly: usp.priceMonthly,
        priceShow: usp.priceShow,
        stock: usp.stock,
        status: usp.status
      };
    });

    ok(res, {
      groups: Array.from(groupSet.values()).sort((a, b) => groupSort(a.name) - groupSort(b.name)),
      areas: Array.from(areaSet.values()).sort((a, b) => groupSort(a.group) - groupSort(b.group)),
      products
    });
  }));

  // ── Clean up test business data ──

  const CLEANUP_CONFIRM = 'CLEAR_TEST_BUSINESS_DATA';

  app.post('/api/admin/maintenance/cleanup-test-business-data', requireAdmin, asyncRoute(async (req, res) => {
    const dryRun = req.body.dryRun !== false;
    const confirm = req.body.confirm || '';

    const counts = {
      Renewal: await prisma.renewal.count(),
      Server: await prisma.server.count(),
      Notification: await prisma.notification.count(),
      WalletTransaction: await prisma.walletTransaction.count(),
      TicketReply: await prisma.ticketReply.count(),
      Ticket: await prisma.ticket.count(),
      ImpersonationToken: await prisma.impersonationToken.count(),
      Order: await prisma.order.count()
    };

    if (dryRun) {
      return ok(res, { dryRun: true, counts });
    }

    if (confirm !== CLEANUP_CONFIRM) {
      return fail(res, 40070, `请提供正确的确认码 "${CLEANUP_CONFIRM}"`);
    }

    // Delete in FK-safe order
    const deleted = {};
    const tx = await prisma.$transaction([
      prisma.renewal.deleteMany(),
      prisma.server.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.walletTransaction.deleteMany(),
      prisma.ticketReply.deleteMany(),
      prisma.ticket.deleteMany(),
      prisma.impersonationToken.deleteMany(),
      prisma.order.deleteMany()
    ]);
    deleted.Renewal = tx[0].count;
    deleted.Server = tx[1].count;
    deleted.Notification = tx[2].count;
    deleted.WalletTransaction = tx[3].count;
    deleted.TicketReply = tx[4].count;
    deleted.Ticket = tx[5].count;
    deleted.ImpersonationToken = tx[6].count;
    deleted.Order = tx[7].count;

    await logOperation(req, 'cleanup_test_business_data', 'system', null, { deleted, dryRun: false });

    ok(res, { dryRun: false, counts: deleted });
  }));

  app.post('/api/admin/products/cleanup-test', requireAdmin, asyncRoute(async (req, res) => {
    const testIds = ['seed-1', 'seed-2', 'seed-3'];
    let hardDeleted = 0;
    let offlined = 0;

    for (const id of testIds) {
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) continue;
      const orderCount = await prisma.order.count({ where: { productId: id } });
      if (orderCount > 0) {
        await prisma.product.update({ where: { id }, data: { status: 'off_sale' } });
        offlined++;
      } else {
        await prisma.product.delete({ where: { id } });
        hardDeleted++;
      }
    }

    await logOperation(req, 'cleanup_test_products', 'product', null, { hardDeleted, offlined });
    ok(res, { hardDeleted, offlined, message: `清理完成：硬删除 ${hardDeleted} 个，下架 ${offlined} 个` });
  }));

  app.use('/api', (_req, res) => fail(res, 40400, 'API endpoint not found', 404));

  app.use((error, _req, res, _next) => {
    console.error(error);
    fail(res, 50000, error.message || '服务器错误', 500);
  });

  // ── Auto-sync REMOVED — upstream sync must be manual ──
  // Auto-sync disabled — admin must manually trigger upstream data fetch via /admin/products

  return app;
}
