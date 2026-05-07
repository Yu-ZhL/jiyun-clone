import 'dotenv/config';

console.log('Worker process started. Scheduled jobs will be added in later phases.');

setInterval(() => {
  console.log(`[worker] heartbeat ${new Date().toISOString()}`);
}, 60_000);
