import { createApp } from './app.js';
import { createPrismaClient } from './config/database.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';

let env;
try {
  env = loadEnv();
} catch (error) {
  // The logger is not configured yet: print the (secret-free) list of invalid variables and stop.
  console.error(error.message);
  process.exit(1);
}

const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({ env, prisma, logger });

const server = app.listen(env.API_PORT, () => {
  logger.info(`Tigmi API listening on http://localhost:${env.API_PORT}/api/v1`);
});

server.on('error', (error) => {
  logger.fatal({ err: error }, 'API server failed to start');
  process.exit(1);
});

// Graceful shutdown: stop accepting connections, finish in-flight requests, close the DB pool.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
