import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/config/database.js';
import { createTestEnv } from '../helpers/test-env.js';

const logger = pino({ level: 'silent' });

describe('GET /api/v1/health (real database)', () => {
  const env = createTestEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = createApp({ env, prisma, logger });

  afterAll(() => prisma.$disconnect());

  it('returns 200 and database "up" when PostgreSQL is reachable', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', database: 'up' } });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,64}$/);
  });

  it('allows configured origins and ignores unknown ones (CORS)', async () => {
    const allowed = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5180');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5180');

    const blocked = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('GET /api/v1/health (unreachable database)', () => {
  // Port 1 is never a PostgreSQL server, so every query fails fast.
  const env = createTestEnv({ DATABASE_URL: 'postgresql://nobody:wrong@127.0.0.1:1/none_test' });
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = createApp({ env, prisma, logger });

  afterAll(() => prisma.$disconnect());

  it('returns 503 and database "down" without leaking error details', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ data: { status: 'degraded', database: 'down' } });
  });
});

describe('error format', () => {
  const env = createTestEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = createApp({ env, prisma, logger });

  afterAll(() => prisma.$disconnect());

  it('returns a JSON 404 with code and request id for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('reuses a well-formed X-Request-Id and replaces a malicious one', async () => {
    const good = await request(app).get('/api/v1/health').set('X-Request-Id', 'proxy-id-12345');
    expect(good.headers['x-request-id']).toBe('proxy-id-12345');

    const bad = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', '<script>injected</script>');
    expect(bad.headers['x-request-id']).not.toContain('injected');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
