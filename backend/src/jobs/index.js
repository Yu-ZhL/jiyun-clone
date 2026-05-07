const dayMs = 24 * 60 * 60 * 1000;

async function settingInt(prisma, key, fallback) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return Number(setting?.value || process.env[key.toUpperCase()] || fallback);
}

export async function scanExpiringServers(prisma) {
  const remindDays = await settingInt(prisma, 'expiry_remind_days', process.env.EXPIRY_REMIND_DAYS || 7);
  const now = new Date();
  const limit = new Date(now.getTime() + remindDays * dayMs);
  const servers = await prisma.server.findMany({
    where: {
      status: 'running',
      expiresAt: { lte: limit, gt: now },
      deletedAt: null
    }
  });

  let notifications = 0;
  for (const server of servers) {
    await prisma.server.update({ where: { id: server.id }, data: { status: 'expiring' } });
    const existing = await prisma.notification.findFirst({
      where: { userId: server.userId, type: 'expiry_reminder', content: { contains: server.id } }
    });
    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: server.userId,
          type: 'expiry_reminder',
          title: '服务器即将到期',
          content: `${server.name} (${server.id}) 将于 ${server.expiresAt.toISOString().slice(0, 10)} 到期，请及时续费。`
        }
      });
      notifications += 1;
    }
  }
  return { scanned: servers.length, notifications };
}

export async function scanExpiredServers(prisma) {
  const overdueDays = await settingInt(prisma, 'overdue_suspend_days', process.env.OVERDUE_SUSPEND_DAYS || 3);
  const now = new Date();
  const expired = await prisma.server.updateMany({
    where: {
      status: { in: ['running', 'expiring'] },
      expiresAt: { lt: now },
      deletedAt: null
    },
    data: { status: 'expired' }
  });
  const suspendBefore = new Date(now.getTime() - overdueDays * dayMs);
  const suspended = await prisma.server.updateMany({
    where: {
      status: 'expired',
      expiresAt: { lt: suspendBefore },
      deletedAt: null
    },
    data: { status: 'suspended', suspendedAt: now }
  });
  return { expired: expired.count, suspended: suspended.count };
}

export async function cancelExpiredOrders(prisma) {
  const hours = Number(process.env.UNPAID_ORDER_CANCEL_HOURS || 24);
  const deadline = new Date(Date.now() - hours * 60 * 60 * 1000);
  const cancelled = await prisma.order.updateMany({
    where: {
      payStatus: 'unpaid',
      createdAt: { lt: deadline }
    },
    data: {
      payStatus: 'cancelled',
      cancelledAt: new Date()
    }
  });
  return { cancelled: cancelled.count };
}

export async function cleanupExpiredTokens(prisma) {
  const cleaned = await prisma.impersonationToken.updateMany({
    where: {
      usedAt: null,
      expiresAt: { lt: new Date() }
    },
    data: { usedAt: new Date() }
  });
  return { cleaned: cleaned.count };
}

export async function runAllJobs(prisma) {
  const [expiring, expired, orders, tokens] = await Promise.all([
    scanExpiringServers(prisma),
    scanExpiredServers(prisma),
    cancelExpiredOrders(prisma),
    cleanupExpiredTokens(prisma)
  ]);
  return { expiring, expired, orders, tokens };
}
