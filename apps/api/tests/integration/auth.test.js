import request from 'supertest';
import { hashToken } from '../../src/modules/auth/tokens.js';
import {
  createTestContext,
  parseSetCookies,
  resetDatabase,
  validUser,
} from '../helpers/test-app.js';

const { app, prisma } = createTestContext({
  security: { maxFailedLogins: 3, lockoutSeconds: 60, refreshReuseGraceSeconds: 2 },
});

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const register = (body = validUser(), headers = {}) =>
  request(app).post('/api/v1/auth/register').set(headers).send(body);
const login = (body, headers = {}) =>
  request(app).post('/api/v1/auth/login').set(headers).send(body);

/** Registers via the web flow and returns tokens + cookies. */
async function registerWeb(overrides) {
  const res = await register(validUser(overrides));
  expect(res.status).toBe(201);
  const cookies = parseSetCookies(res);
  return {
    res,
    accessToken: res.body.data.accessToken,
    refreshToken: cookies.tigmi_rt.value,
    csrfToken: cookies.tigmi_csrf.value,
  };
}

const refreshWeb = ({ refreshToken, csrfToken }, csrfHeader = csrfToken) =>
  request(app)
    .post('/api/v1/auth/refresh')
    .set('Cookie', [`tigmi_rt=${refreshToken}`, `tigmi_csrf=${csrfToken}`])
    .set('X-CSRF-Token', csrfHeader ?? '');

const me = (accessToken) =>
  request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

/** Simulates time passing for a refresh token, instead of sleeping in tests. */
const ageRefreshToken = (token, seconds) =>
  prisma.refreshToken.update({
    where: { tokenHash: hashToken(token) },
    data: { usedAt: new Date(Date.now() - seconds * 1000) },
  });

describe('POST /auth/register', () => {
  it('creates the user, a session, and sets secure cookies (web)', async () => {
    const { res, refreshToken } = await registerWeb({ email: '  Amina@Example.COM ' });

    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      fullName: 'Amina Benali',
      email: 'amina@example.com',
      avatarUrl: null,
      preferredLanguage: 'fr',
      emailVerified: false,
      createdAt: expect.any(String),
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.csrfToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toBeUndefined(); // web: never in the body
    expect(res.headers['cache-control']).toBe('no-store');

    const cookies = parseSetCookies(res);
    expect(cookies.tigmi_rt.attributes).toMatchObject({
      httponly: true,
      samesite: 'Strict',
      path: '/api/v1/auth',
    });
    expect(cookies.tigmi_csrf.attributes.httponly).toBeUndefined();
    expect(cookies.tigmi_csrf.attributes).toMatchObject({ samesite: 'Strict', path: '/' });

    const user = await prisma.user.findUnique({ where: { email: 'amina@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    const tokens = await prisma.refreshToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(hashToken(refreshToken)); // only the hash is stored
    expect(await prisma.auditLog.count({ where: { action: 'auth.register' } })).toBe(1);
  });

  it('returns the refresh token in the body and sets no cookie for mobile clients', async () => {
    const res = await register(validUser(), { 'X-Client-Type': 'mobile' });
    expect(res.status).toBe(201);
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.sessionExpiresAt).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a duplicate email regardless of case (409)', async () => {
    await registerWeb();
    const res = await register(validUser({ email: 'AMINA@example.com' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns field-level validation codes', async () => {
    const res = await register({ fullName: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'fullName', code: 'too_short' },
        { field: 'email', code: 'invalid_email' },
        { field: 'password', code: 'password_too_short' },
      ]),
    );
  });

  it('rejects unknown fields such as a self-assigned role', async () => {
    const res = await register({ ...validUser(), role: 'OWNER' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['role'] });
  });

  it('rejects a password equal to the email', async () => {
    const email = 'longaddress@example.com';
    const res = await register(validUser({ email, password: email }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'password', code: 'password_equals_email' }]);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => registerWeb());

  it('logs in with the right password (email is case-insensitive)', async () => {
    const res = await login({ email: 'AMINA@example.com', password: validUser().password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('amina@example.com');
    expect(parseSetCookies(res).tigmi_rt).toBeDefined();
    expect(await prisma.session.count()).toBe(2); // register + login = two devices
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const wrongPassword = await login({ email: 'amina@example.com', password: 'wrong password!' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: 'wrong password!' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }
    expect(await prisma.auditLog.count({ where: { action: 'auth.login_failed' } })).toBe(2);
  });

  it('locks the account after too many failures, even for the right password', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(
        (await login({ email: 'amina@example.com', password: 'wrong password!' })).status,
      ).toBe(401);
    }

    const res = await login({ email: 'amina@example.com', password: validUser().password });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: 'auth.account_locked' } })).toBe(1);
  });

  it('unlocks after the lockout period and resets the failure counter on success', async () => {
    await prisma.user.update({
      where: { email: 'amina@example.com' },
      data: { lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 2 },
    });

    const res = await login({ email: 'amina@example.com', password: validUser().password });
    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email: 'amina@example.com' } });
    expect(user).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  });

  it('never logs the password', async () => {
    const lines = [];
    const { default: pino } = await import('pino');
    const logger = pino({ level: 'trace' }, { write: (line) => lines.push(line) });
    const ctx = createTestContext({ logger });

    await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: 'secret-should-not-leak' });
    await ctx.prisma.$disconnect();

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain('secret-should-not-leak');
  });
});

describe('GET /auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const { accessToken } = await registerWeb();
    const res = await me(accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('amina@example.com');
  });

  it('rejects missing, malformed and tampered tokens', async () => {
    const { accessToken } = await registerWeb();
    const [header, payload] = accessToken.split('.');
    const tampered = `${header}.${payload}.invalidsignature`;

    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await me('not-a-jwt')).body.error.code).toBe('INVALID_ACCESS_TOKEN');
    expect((await me(tampered)).body.error.code).toBe('INVALID_ACCESS_TOKEN');
    expect((await request(app).get('/api/v1/auth/me')).headers['www-authenticate']).toBe('Bearer');
  });

  it('rejects a token whose session was revoked', async () => {
    const { accessToken } = await registerWeb();
    await prisma.session.updateMany({ data: { revokedAt: new Date() } });
    const res = await me(accessToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_REVOKED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a new access token (web)', async () => {
    const session = await registerWeb();
    const res = await refreshWeb(session);

    expect(res.status).toBe(200);
    const cookies = parseSetCookies(res);
    expect(cookies.tigmi_rt.value).not.toBe(session.refreshToken);
    expect(cookies.tigmi_csrf.value).toBe(session.csrfToken);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect((await me(res.body.data.accessToken)).status).toBe(200);
  });

  it('requires the CSRF header to match the CSRF cookie', async () => {
    const session = await registerWeb();
    expect((await refreshWeb(session, null)).body.error.code).toBe('CSRF_TOKEN_INVALID');
    const wrong = await refreshWeb(session, 'x'.repeat(43));
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('answers 409 when two tabs refresh with the same token at the same moment', async () => {
    const session = await registerWeb();
    expect((await refreshWeb(session)).status).toBe(200);

    const second = await refreshWeb(session);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('REFRESH_IN_PROGRESS');
    expect((await prisma.session.findFirst()).revokedAt).toBeNull();
  });

  it('detects reuse of an old token and revokes the whole session', async () => {
    const victim = await registerWeb();
    const rotated = await refreshWeb(victim);
    const newRefreshToken = parseSetCookies(rotated).tigmi_rt.value;
    await ageRefreshToken(victim.refreshToken, 60); // past the grace window

    // An attacker replays the stolen (old) token.
    const replay = await refreshWeb(victim);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(parseSetCookies(replay).tigmi_rt.value).toBe(''); // cookie cleared

    // The legitimate holder of the new token is signed out too.
    const legit = await refreshWeb({ ...victim, refreshToken: newRefreshToken });
    expect(legit.status).toBe(401);
    expect((await me(rotated.body.data.accessToken)).status).toBe(401);

    const session = await prisma.session.findFirst();
    expect(session.revokedReason).toBe('refresh_token_reuse');
    expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_token_reuse' } })).toBe(1);
  });

  it('works for mobile clients with the token in the body (no CSRF needed)', async () => {
    const reg = await register(validUser(), { 'X-Client-Type': 'mobile' });
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).not.toBe(reg.body.data.refreshToken);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects unknown, missing and expired-session tokens', async () => {
    const session = await registerWeb();

    const unknown = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'x'.repeat(43) });
    expect(unknown.status).toBe(401);

    const missing = await request(app).post('/api/v1/auth/refresh');
    expect(missing.status).toBe(401);

    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await refreshWeb(session)).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session, clears cookies and invalidates both tokens', async () => {
    const session = await registerWeb();
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(204);
    const cookies = parseSetCookies(res);
    expect(cookies.tigmi_rt.value).toBe('');
    expect(cookies.tigmi_csrf.value).toBe('');

    expect((await me(session.accessToken)).status).toBe(401);
    expect((await refreshWeb(session)).status).toBe(401);
    expect((await prisma.session.findFirst()).revokedReason).toBe('logout');
    expect(await prisma.auditLog.count({ where: { action: 'auth.logout' } })).toBe(1);
  });

  it('only signs out the current device', async () => {
    const first = await registerWeb();
    const second = await login({ email: 'amina@example.com', password: validUser().password });

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first.accessToken}`);

    expect((await me(second.body.data.accessToken)).status).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED once the login limit is reached', async () => {
    const limited = createTestContext({
      security: { rateLimits: { login: { windowSeconds: 60, limit: 2 } } },
    });
    const attempt = () =>
      request(limited.app)
        .post('/api/v1/auth/login')
        .send({ email: 'x@example.com', password: 'whatever' });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
    await limited.prisma.$disconnect();
  });
});
