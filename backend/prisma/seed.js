import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { encryptPassword } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

const cents = (value) => Math.round(value * 100);

async function main() {
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

  const demoPasswordHash = await bcrypt.hash('123456', 12);
  const demoUser = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@example.hk',
      passwordHash: demoPasswordHash,
      balance: cents(2000),
      status: 'active'
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

  const sampleOrder = await prisma.order.upsert({
    where: { orderNo: 'JY202605070001' },
    update: {},
    create: {
      orderNo: 'JY202605070001',
      userId: demoUser.id,
      productId: 'seed-1',
      type: 'new_server',
      cycle: 'monthly',
      amount: cents(60),
      payMethod: 'balance',
      payStatus: 'paid',
      provisionStatus: 'opened',
      paidAt: new Date(),
      openedAt: new Date()
    }
  });

  await prisma.server.upsert({
    where: { orderId: sampleOrder.id },
    update: {},
    create: {
      userId: demoUser.id,
      productId: 'seed-1',
      orderId: sampleOrder.id,
      name: 'HK-CN2-DEMO',
      ip: '103.88.12.18',
      os: 'Ubuntu 22.04',
      loginUser: 'root',
      loginPasswordEncrypted: encryptPassword('Demo@123456'),
      status: 'running',
      openedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  const settings = {
    site_name: '极云主机管理系统',
    support_phone: '800-800-8000',
    support_email: 'support@example.com',
    copyright: '版权信息:11111',
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
