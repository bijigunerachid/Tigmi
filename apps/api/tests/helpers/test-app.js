import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/config/database.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { createMailService } from '../../src/modules/mail/mail.service.js';
import { createTestEnv } from './test-env.js';

const HIGH = { windowSeconds: 60, limit: 10_000 };

/** Transport that keeps sent emails in memory instead of talking to SMTP. */
export function createMemoryTransport() {
  const outbox = [];
  return {
    outbox,
    async sendMail(message) {
      outbox.push(message);
      return { messageId: `memory-${outbox.length}` };
    },
  };
}

/**
 * App wired to the real test database and an in-memory mailbox (`outbox`).
 * Rate limits are effectively disabled unless a test passes its own `security.rateLimits`.
 * Call `await mail.flush()` before reading `outbox`.
 */
export function createTestContext({ security = {}, logger } = {}) {
  const env = createTestEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const resolvedLogger = logger ?? pino({ level: 'silent' });
  const transport = createMemoryTransport();
  const mail = createMailService({
    transport,
    from: env.MAIL_FROM,
    appUrl: env.APP_URL,
    logger: resolvedLogger,
  });
  const app = createApp({
    env,
    prisma,
    logger: resolvedLogger,
    mail,
    security: {
      ...security,
      rateLimits: {
        global: HIGH,
        login: HIGH,
        register: HIGH,
        refresh: HIGH,
        emailRequest: HIGH,
        tokenSubmit: HIGH,
        invite: HIGH,
        ...security.rateLimits,
      },
    },
  });
  return { env, prisma, app, mail, outbox: transport.outbox };
}

/** Returns the emails sent to an address (waits for in-flight sends first). */
export async function emailsTo(ctx, address) {
  await ctx.mail.flush();
  return ctx.outbox.filter((message) => message.to === address);
}

/** Extracts the token from a link like https://app/verify-email#token=XXXX. */
export function tokenFromEmail(message) {
  const match = /#token=([\w-]{43})/.exec(message.text);
  if (!match) throw new Error(`No token link in email "${message.subject}"`);
  return match[1];
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

let sharedHashPromise;
const TEST_PASSWORD = 'a long family passphrase';

/**
 * Creates a verified user directly in the database and signs in through the real API.
 * Returns { user, accessToken, auth } where `auth` is the Authorization header value.
 */
export async function createSignedInUser(ctx, { fullName = 'Test User', email } = {}) {
  sharedHashPromise ??= hashPassword(TEST_PASSWORD);
  const address = email ?? `user-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const user = await ctx.prisma.user.create({
    data: {
      fullName,
      email: address,
      passwordHash: await sharedHashPromise,
      emailVerifiedAt: new Date(),
    },
  });
  const res = await request(ctx.app)
    .post('/api/v1/auth/login')
    .send({ email: address, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed in test helper: ${res.status}`);
  const accessToken = res.body.data.accessToken;
  return { user, accessToken, auth: `Bearer ${accessToken}` };
}
