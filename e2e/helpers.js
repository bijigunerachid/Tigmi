import { expect } from '@playwright/test';

export const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://localhost:8025/api/v1';
export const PASSWORD = 'a long family passphrase';

export const uniqueEmail = (prefix = 'e2e') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Waits for the newest `kind` link (verify-email | reset-password | invitations/accept) emailed to `to`. */
export async function tokenFromInbox(request, to, kind) {
  const pattern = new RegExp(`/${kind}#token=([\\w-]{43})`);
  let token;
  await expect
    .poll(
      async () => {
        const search = await request.get(
          `${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`,
        );
        const [latest] = (await search.json()).messages ?? [];
        if (!latest) return null;
        const message = await (await request.get(`${MAILPIT_API}/message/${latest.ID}`)).json();
        token = pattern.exec(message.Text)?.[1] ?? null;
        return token;
      },
      { timeout: 10_000 },
    )
    .not.toBeNull();
  return token;
}

/** Full real sign-up: register → read the email in Mailpit → verify → log in. */
export async function signUp(request, { fullName = 'E2E Famille', email = uniqueEmail() } = {}) {
  expect(
    (
      await request.post('/api/v1/auth/register', { data: { fullName, email, password: PASSWORD } })
    ).status(),
  ).toBe(202);
  const token = await tokenFromInbox(request, email, 'verify-email');
  expect((await request.post('/api/v1/auth/verify-email', { data: { token } })).status()).toBe(204);
  const login = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status()).toBe(200);
  const { accessToken } = (await login.json()).data;
  return { email, headers: { Authorization: `Bearer ${accessToken}` } };
}

/** Runs an automatic WCAG 2 A/AA scan of the current page. */
export async function expectAccessible(page) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
  ).toEqual([]);
}

/** Fails if the page scrolls sideways (the most common phone layout bug). */
export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

/** Saves a full-page screenshot next to the test results, named per viewport. */
export async function snap(page, testInfo, name) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`),
    fullPage: true,
  });
}

/** Turns an emailed link token into a path on the app under test. */
export const linkPath = (kind, token) => `/${kind}#token=${token}`;
