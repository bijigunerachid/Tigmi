import { expect, test } from '@playwright/test';
import { PASSWORD, tokenFromInbox, uniqueEmail } from './helpers.js';

// API journey through the Vite proxy with a real cookie jar (same origin as the browser app)
// and real email delivery through Mailpit. The screens arrive in feature/web-auth.
test.describe('Auth session journey (HTTP, real cookies, real email)', () => {
  test.skip(({ isMobile }) => isMobile, 'HTTP-only journey: running once is enough');

  test('register → verify email → login → me → refresh → logout → reset password', async ({
    request,
    baseURL,
  }) => {
    const email = uniqueEmail();

    const register = await request.post('/api/v1/auth/register', {
      data: { fullName: 'E2E Famille', email, password: PASSWORD },
    });
    expect(register.status()).toBe(202);

    const early = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
    expect((await early.json()).error.code).toBe('EMAIL_NOT_VERIFIED');

    const verify = await request.post('/api/v1/auth/verify-email', {
      data: { token: await tokenFromInbox(request, email, 'verify-email') },
    });
    expect(verify.status()).toBe(204);

    const login = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
    expect(login.status()).toBe(200);
    const { accessToken, csrfToken } = (await login.json()).data;

    const cookies = (await request.storageState()).cookies;
    const refreshCookie = cookies.find((c) => c.name === 'tigmi_rt');
    expect(refreshCookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Strict',
      path: '/api/v1/auth',
    });
    expect(cookies.find((c) => c.name === 'tigmi_csrf')?.value).toBe(csrfToken);

    const me = await request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(me.status()).toBe(200);
    expect((await me.json()).data.user.email).toBe(email);

    // Without the CSRF header the cookie alone is not enough.
    expect((await request.post('/api/v1/auth/refresh')).status()).toBe(403);

    const refresh = await request.post('/api/v1/auth/refresh', {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(refresh.status()).toBe(200);
    const rotated = (await request.storageState()).cookies.find((c) => c.name === 'tigmi_rt');
    expect(rotated.value).not.toBe(refreshCookie.value);
    const newAccessToken = (await refresh.json()).data.accessToken;

    const logout = await request.post('/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    expect(logout.status()).toBe(204);
    expect(
      (await request.storageState()).cookies.find((c) => c.name === 'tigmi_rt'),
    ).toBeUndefined();

    const afterLogout = await request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    expect(afterLogout.status()).toBe(401);

    // Forgotten password: the reset link arrives by email and the new password works.
    const forgot = await request.post('/api/v1/auth/forgot-password', { data: { email } });
    expect(forgot.status()).toBe(202);
    const newPassword = 'a brand new family passphrase';
    const reset = await request.post('/api/v1/auth/reset-password', {
      data: {
        token: await tokenFromInbox(request, email, 'reset-password'),
        password: newPassword,
      },
    });
    expect(reset.status()).toBe(204);
    const relogin = await request.post('/api/v1/auth/login', {
      data: { email, password: newPassword },
    });
    expect(relogin.status()).toBe(200);

    expect(baseURL).toContain('5190'); // went through the web origin, not the API port
  });
});
