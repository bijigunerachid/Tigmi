import { expect, test } from '@playwright/test';

// API journey through the Vite proxy with a real cookie jar (same origin as the browser app).
// The UI for these screens arrives in feature/web-auth; this proves the cookie contract now.
test.describe('Auth session journey (HTTP, real cookies)', () => {
  test.skip(({ isMobile }) => isMobile, 'HTTP-only journey: running once is enough');

  test('register → me → refresh (rotation + CSRF) → logout → refresh rejected', async ({
    request,
    baseURL,
  }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    const register = await request.post('/api/v1/auth/register', {
      data: { fullName: 'E2E Famille', email, password: 'a long family passphrase' },
    });
    expect(register.status()).toBe(201);
    const { accessToken, csrfToken } = (await register.json()).data;

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
    expect(baseURL).toContain('5190'); // went through the web origin, not the API port
  });
});
