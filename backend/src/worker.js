import 'dotenv/config';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import {
  cancelExpiredOrders,
  cleanupExpiredTokens,
  runAllJobs,
  scanExpiredServers,
  scanExpiringServers
} from './jobs/index.js';

const prisma = new PrismaClient();

async function run(name, job) {
  try {
    const result = await job(prisma);
    console.log(`[worker] ${name}`, JSON.stringify(result));
  } catch (error) {
    console.error(`[worker] ${name} failed`, error);
  }
}

console.log('Worker process started.');

await run('startup', runAllJobs);

cron.schedule('0 9 * * *', () => run('scanExpiringServers', scanExpiringServers));
cron.schedule('0 * * * *', () => run('scanExpiredServers', scanExpiredServers));
cron.schedule('5 * * * *', () => run('cancelExpiredOrders', cancelExpiredOrders));
cron.schedule('10 * * * *', () => run('cleanupExpiredTokens', cleanupExpiredTokens));

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
