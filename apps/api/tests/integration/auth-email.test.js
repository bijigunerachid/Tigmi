import request from 'supertest';
import {
  createTestContext,
  emailsTo,
  resetDatabase,
  tokenFromEmail,
  validUser,
} from '../helpers/test-app.js';

const ctx = createTestContext({ security: { emailCooldownSeconds: 60 } });
const { app, prisma } = ctx;
const EMAIL = 'amina@example.com';
const PASSWORD = validUser().password;
const NEW_PASSWORD = 'a brand new family passphrase';

beforeEach(async () => {
  await ctx.mail.flush();
  ctx.outbox.length = 0;
  await resetDatabase(prisma);
});
afterAll(() => prisma.$disconnect());

const post = (path, body) => request(app).post(`/api/v1/auth/${path}`).send(body);
const login = (password = PASSWORD) => post('login', { email: EMAIL, password });
const lastEmail = async () => (await emailsTo(ctx, EMAIL)).at(-1);

/** Lets the per-account email cooldown pass without sleeping. */
const ageTokens = () =>
  prisma.userToken.updateMany({ data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } });

async function registerAndVerify(overrides) {
  await post('register', validUser(overrides));
  const token = tokenFromEmail(await lastEmail());
  expect((await post('verify-email', { token })).status).toBe(204);
}

describe('verification email', () => {
  it('is sent in French with a single-use link that verifies the account', async () => {
    await post('register', validUser());
    const [email] = await emailsTo(ctx, EMAIL);

    expect(email.subject).toBe('Confirmez votre adresse e-mail — Tigmi');
    expect(email.from).toBe('Tigmi <no-reply@tigmi.local>');
    expect(email.text).toContain('Bonjour Amina Benali,');
    expect(email.text).toMatch(/http:\/\/localhost:5180\/verify-email#token=[\w-]{43}/);
    expect(email.html).toContain('lang="fr" dir="ltr"');

    const token = tokenFromEmail(email);
    expect((await post('verify-email', { token })).status).toBe(204);
    expect((await login()).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'auth.email_verified' } })).toBe(1);

    const reused = await post('verify-email', { token });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('is sent in Arabic, right-to-left, for Arabic-speaking users', async () => {
    await post('register', validUser({ fullName: 'أمينة بنعلي', preferredLanguage: 'ar' }));
    const email = await lastEmail();
    expect(email.subject).toBe('تأكيد بريدك الإلكتروني — Tigmi');
    expect(email.text).toContain('مرحبًا أمينة بنعلي،');
    expect(email.html).toContain('lang="ar" dir="rtl"');
  });

  it('escapes HTML in names so emails cannot carry injected markup', async () => {
    await post('register', validUser({ fullName: '<img src=x onerror=alert(1)>' }));
    const email = await lastEmail();
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('rejects expired, unknown and malformed tokens', async () => {
    await post('register', validUser());
    const token = tokenFromEmail(await lastEmail());
    await prisma.userToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await post('verify-email', { token })).body.error.code).toBe(
      'INVALID_OR_EXPIRED_TOKEN',
    );
    expect((await post('verify-email', { token: 'x'.repeat(43) })).status).toBe(400);
    const malformed = await post('verify-email', { token: 'short' });
    expect(malformed.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'token', code: 'invalid_token' }],
    });
  });

  it('does not accept a password-reset token as a verification token', async () => {
    await registerAndVerify();
    await post('forgot-password', { email: EMAIL });
    const resetToken = tokenFromEmail(await lastEmail());
    expect((await post('verify-email', { token: resetToken })).status).toBe(400);
  });
});

describe('POST /auth/register with an existing email', () => {
  it('sends an "account exists" email instead of a verification link', async () => {
    await registerAndVerify();
    ctx.outbox.length = 0;

    await post('register', validUser({ password: 'someone else passphrase' }));
    const [email] = await emailsTo(ctx, EMAIL);
    expect(email.subject).toBe('Vous avez déjà un compte Tigmi');
    expect(email.text).toContain('http://localhost:5180/forgot-password');
    expect(email.text).not.toContain('#token=');
  });
});

describe('POST /auth/resend-verification', () => {
  it('sends a new link that replaces the previous one', async () => {
    await post('register', validUser());
    const first = tokenFromEmail(await lastEmail());
    await ageTokens();

    const res = await post('resend-verification', { email: EMAIL });
    expect(res.status).toBe(202);
    const second = tokenFromEmail(await lastEmail());

    expect(second).not.toBe(first);
    expect((await post('verify-email', { token: first })).status).toBe(400);
    expect((await post('verify-email', { token: second })).status).toBe(204);
  });

  it('answers the same for unknown and verified emails, and sends nothing', async () => {
    await registerAndVerify();
    ctx.outbox.length = 0;

    const unknown = await post('resend-verification', { email: 'nobody@example.com' });
    const verified = await post('resend-verification', { email: EMAIL });
    expect(unknown.status).toBe(202);
    expect(verified.body).toEqual(unknown.body);
    await ctx.mail.flush();
    expect(ctx.outbox).toHaveLength(0);
  });

  it('sends at most one email per cooldown period (anti email-bombing)', async () => {
    await post('register', validUser());
    await post('resend-verification', { email: EMAIL });
    await post('resend-verification', { email: EMAIL });
    expect(await emailsTo(ctx, EMAIL)).toHaveLength(1);
  });
});

describe('password reset', () => {
  async function requestReset() {
    const res = await post('forgot-password', { email: EMAIL });
    expect(res.status).toBe(202);
    return tokenFromEmail(await lastEmail());
  }

  it('answers identically for unknown emails and sends nothing', async () => {
    const res = await post('forgot-password', { email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ data: { status: 'check_email' } });
    await ctx.mail.flush();
    expect(ctx.outbox).toHaveLength(0);
  });

  it('sets the new password, signs out every device and notifies the user', async () => {
    await registerAndVerify();
    const session = await login();
    const accessToken = session.body.data.accessToken;
    const token = await requestReset();
    expect((await lastEmail()).subject).toBe('Réinitialisation de votre mot de passe — Tigmi');

    const res = await post('reset-password', { token, password: NEW_PASSWORD });
    expect(res.status).toBe(204);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
    expect((await prisma.session.findFirst()).revokedReason).toBe('password_reset');

    expect((await login(PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect((await lastEmail()).subject).toBe('Votre mot de passe a été modifié — Tigmi');
    expect(await prisma.auditLog.count({ where: { action: 'auth.password_reset' } })).toBe(1);
  });

  it('works only once', async () => {
    await registerAndVerify();
    const token = await requestReset();
    expect((await post('reset-password', { token, password: NEW_PASSWORD })).status).toBe(204);
    const again = await post('reset-password', { token, password: 'yet another passphrase' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('rejects an expired link', async () => {
    await registerAndVerify();
    const token = await requestReset();
    await prisma.userToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post('reset-password', { token, password: NEW_PASSWORD })).status).toBe(400);
  });

  it('only the most recent link works', async () => {
    await registerAndVerify();
    const first = await requestReset();
    await ageTokens();
    const second = await requestReset();
    expect((await post('reset-password', { token: first, password: NEW_PASSWORD })).status).toBe(
      400,
    );
    expect((await post('reset-password', { token: second, password: NEW_PASSWORD })).status).toBe(
      204,
    );
  });

  it('rejects a weak password without using up the link', async () => {
    await registerAndVerify();
    const token = await requestReset();

    const short = await post('reset-password', { token, password: 'short' });
    expect(short.body.error.details).toEqual([{ field: 'password', code: 'password_too_short' }]);
    const sameAsEmail = await post('reset-password', { token, password: EMAIL });
    expect(sameAsEmail.body.error.details).toEqual([
      { field: 'password', code: 'password_equals_email' },
    ]);

    expect((await post('reset-password', { token, password: NEW_PASSWORD })).status).toBe(204);
  });

  it('verifies the email and lifts a lockout (it proves inbox ownership)', async () => {
    await post('register', validUser());
    await prisma.user.update({
      where: { email: EMAIL },
      data: { lockedUntil: new Date(Date.now() + 60_000), failedLoginCount: 3 },
    });
    const token = await requestReset();

    expect((await post('reset-password', { token, password: NEW_PASSWORD })).status).toBe(204);
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user).toMatchObject({ lockedUntil: null, failedLoginCount: 0 });
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it('only stores token hashes in the database', async () => {
    await registerAndVerify();
    const token = await requestReset();
    const rows = await prisma.userToken.findMany();
    expect(
      rows.every((row) => row.tokenHash !== token && /^[0-9a-f]{64}$/.test(row.tokenHash)),
    ).toBe(true);
  });
});

describe('email delivery failure', () => {
  it('never fails the request when SMTP is down', async () => {
    const failing = createTestContext();
    failing.outbox.push = () => {
      throw new Error('SMTP down');
    };
    const res = await request(failing.app).post('/api/v1/auth/register').send(validUser());
    expect(res.status).toBe(202);
    await failing.mail.flush();
    await failing.prisma.$disconnect();
  });
});
