import pino from 'pino';
import { createApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/config/database.js';
import { createTestEnv } from './test-env.js';

const HIGH = { windowSeconds: 60, limit: 10_000 };

/**
 * App wired to the real test database. Rate limits are effectively disabled unless a test
 * passes its own `security.rateLimits`, so unrelated tests never trip them.
 */
export function createTestContext({ security = {}, logger } = {}) {
  const env = createTestEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = createApp({
    env,
    prisma,
    logger: logger ?? pino({ level: 'silent' }),
    security: {
      ...security,
      rateLimits: {
        global: HIGH,
        login: HIGH,
        register: HIGH,
        refresh: HIGH,
        ...security.rateLimits,
      },
    },
  });
  return { env, prisma, app };
}

/** Empties every application table (keeps Prisma's migration history). */
export async function resetDatabase(prisma) {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

/** Parses Set-Cookie headers into { name: { value, attributes } } for assertions. */
export function parseSetCookies(res) {
  const cookies = {};
  for (const raw of res.headers['set-cookie'] ?? []) {
    const [pair, ...attrs] = raw.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const attributes = {};
    for (const attr of attrs) {
      const [key, value] = attr.split('=');
      attributes[key.toLowerCase()] = value ?? true;
    }
    cookies[name] = { value: decodeURIComponent(pair.slice(separator + 1)), attributes };
  }
  return cookies;
}

export const validUser = (overrides = {}) => ({
  fullName: 'Amina Benali',
  email: 'amina@example.com',
  password: 'a long family passphrase',
  ...overrides,
});
