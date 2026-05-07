import 'dotenv/config';
import { createApp, prisma } from './app.js';

const port = Number(process.env.API_PORT || 3000);
const app = createApp();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
