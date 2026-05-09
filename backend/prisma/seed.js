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

  // No more seed demo products — products now come from upstream sync.
  // Clean up legacy seed products that have no orders.
  const seedIds = ['seed-1', 'seed-2', 'seed-3'];
  for (const id of seedIds) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (product) {
      const orderCount = await prisma.order.count({ where: { productId: id } });
      if (orderCount === 0) {
        await prisma.product.delete({ where: { id } }).catch(() => {});
      } else {
        await prisma.product.update({ where: { id }, data: { status: 'off_sale' } }).catch(() => {});
      }
    }
  }

  // Seed default upstream source
  await prisma.upstreamSource.upsert({
    where: { id: 'upstream-fastmos' },
    update: { apiUrl: 'https://www.fastmos.com/host/get_data/get_buy_info' },
    create: {
      id: 'upstream-fastmos',
      name: 'Fastmos',
      apiUrl: 'https://www.fastmos.com/host/get_data/get_buy_info',
      defaultParams: JSON.stringify({ area_id: '0', server_id: '0', parent_id: '0', buy_type: 'rent', netline_id: '0' }),
      status: 'active'
    }
  });

  const settings = {
    site_name: '极云主机管理系统',
    support_phone: '800-800-8000',
    support_email: 'support@example.com',
    copyright: 'Copyright © 极云主机管理系统',
    hero_title: '香港服务器',
    hero_subtitle: 'T3+ 安全数据中心，BGP 国际多线与 CN2 线路，适合企业网站、电商和跨境业务。',
    registration_enabled: 'true',
    expiry_remind_days: process.env.EXPIRY_REMIND_DAYS || '7',
    overdue_suspend_days: process.env.OVERDUE_SUSPEND_DAYS || '3',
    sales_contact_title: '联系客服开通服务器',
    sales_contact_text: '请通过以下方式联系客服，我们将为您开通所需服务器配置。',
    sales_contact_phone: '+852 800-888-888',
    sales_contact_wechat: 'jiyun_support',
    sales_contact_qr_url: '',
    operation_log_retention_days: '90'
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
