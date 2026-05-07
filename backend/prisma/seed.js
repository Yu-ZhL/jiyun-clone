import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cents = (value) => Math.round(value * 100);

async function main() {
  const legacyDemo = await prisma.user.findUnique({ where: { username: 'demo' } });
  if (legacyDemo?.email === 'demo@example.hk') {
    const legacyOrders = await prisma.order.findMany({ where: { userId: legacyDemo.id }, select: { id: true } });
    const legacyOrderIds = legacyOrders.map((order) => order.id);
    const legacyTickets = await prisma.ticket.findMany({ where: { userId: legacyDemo.id }, select: { id: true } });
    const legacyTicketIds = legacyTickets.map((ticket) => ticket.id);
    await prisma.ticketReply.deleteMany({ where: { ticketId: { in: legacyTicketIds } } });
    await prisma.ticket.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.notification.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.walletTransaction.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.renewal.deleteMany({ where: { orderId: { in: legacyOrderIds } } });
    await prisma.server.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.order.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.impersonationToken.deleteMany({ where: { userId: legacyDemo.id } });
    await prisma.user.delete({ where: { id: legacyDemo.id } });
  }

  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
  await prisma.admin.upsert({
    where: { username: process.env.ADMIN_DEFAULT_USERNAME || 'admin' },
    update: {},
    create: {
      username: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: '系统管理员',
      role: 'super_admin'
    }
  });

  const products = [
    {
      name: '香港 BGP 云服务器',
      type: '云服务器',
      location: '中国香港',
      cpu: '4 vCPU',
      memory: '8 GB',
      disk: '120 GB SSD',
      bandwidth: '20M CN2/BGP',
      defense: '50G 防护',
      priceMonthly: cents(60),
      priceYearly: cents(600),
      stock: 30,
      sortOrder: 1,
      description: '适合企业官网、跨境电商和轻量业务。'
    },
    {
      name: '香港独立服务器 E5',
      type: '服务器租用',
      location: 'HK T3+ 数据中心',
      cpu: 'E5-2680 v4',
      memory: '32 GB',
      disk: '1 TB SSD',
      bandwidth: '30M 独享',
      defense: '100G 防护',
      priceMonthly: cents(360),
      priceYearly: cents(3600),
      stock: 8,
      sortOrder: 2,
      description: '独享硬件资源，适合高负载业务。'
    },
    {
      name: '1U 服务器托管',
      type: '服务器托管',
      location: '中国香港',
      cpu: '自带设备',
      memory: '1U 机位',
      disk: '双路电力',
      bandwidth: '10M 独享',
      defense: '基础清洗',
      priceMonthly: cents(500),
      priceYearly: cents(5000),
      stock: 12,
      sortOrder: 3,
      description: '香港机房标准机位、电力与带宽托管。'
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: `seed-${product.sortOrder}` },
      update: product,
      create: { id: `seed-${product.sortOrder}`, ...product }
    });
  }

  const settings = {
    site_name: '极云主机管理系统',
    support_phone: '800-800-8000',
    support_email: 'support@example.com',
    copyright: 'Copyright © 极云主机管理系统',
    hero_title: '香港服务器',
    hero_subtitle: 'T3+ 安全数据中心，BGP 国际多线与 CN2 线路，适合企业网站、电商和跨境业务。',
    registration_enabled: 'true',
    expiry_remind_days: process.env.EXPIRY_REMIND_DAYS || '7',
    overdue_suspend_days: process.env.OVERDUE_SUSPEND_DAYS || '3'
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
