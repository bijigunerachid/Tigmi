import { expect, test } from '@playwright/test';
import {
  MAILPIT_API,
  PASSWORD,
  expectAccessible,
  expectNoHorizontalOverflow,
  linkPath,
  snap,
  tokenFromInbox,
  uniqueEmail,
} from './helpers.js';

/**
 * Arabic gets the same quality bar as French: right-to-left layout, Arabic copy everywhere,
 * Arabic emails for Arabic accounts, accessibility scans and no sideways scrolling.
 */
test.describe('Arabic (right-to-left)', () => {
  test.describe.configure({ timeout: 90_000 });

  async function checkPage(page, testInfo, name) {
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    await snap(page, testInfo, `ar-${name}`);
  }

  test('switching language mirrors the layout and is remembered', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('button', { name: 'العربية' }).click();

    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'العربية' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await checkPage(page, testInfo, 'login');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Translated validation messages.
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByText('أدخل بريدًا إلكترونيًا صالحًا.')).toBeVisible();

    await page.getByRole('button', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('full journey in Arabic: sign up, Arabic email, households', async ({
    page,
    request,
    isMobile,
  }, testInfo) => {
    const email = uniqueEmail('arabic');
    await page.goto('/register');
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(page.getByRole('heading', { name: 'إنشاء حساب' })).toBeVisible();
    await checkPage(page, testInfo, 'register');

    await page.getByLabel('الاسم الكامل').fill('أمينة بنعلي');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'إنشاء حسابي' }).click();
    await expect(page.getByRole('heading', { name: 'تحقّق من بريدك الوارد' })).toBeVisible();

    // The account was created in Arabic, so the verification email is in Arabic.
    const token = await tokenFromInbox(request, email, 'verify-email');
    const search = await request.get(
      `${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    expect((await search.json()).messages[0].Subject).toBe('تأكيد بريدك الإلكتروني — Tigmi');

    await page.goto(linkPath('verify-email', token));
    await expect(page.getByText('تم تأكيد بريدك الإلكتروني.', { exact: false })).toBeVisible();
    await page.getByRole('link', { name: 'تسجيل الدخول' }).click();
    // Wait for the sign-in page: during the view transition the verify page (whose title
    // also contains "البريد الإلكتروني") is still mounted, and getByLabel matches substrings.
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page.getByRole('heading', { name: 'منازلي' })).toBeVisible();
    await expect(page.getByText('مرحبًا، أمينة')).toBeVisible();
    await checkPage(page, testInfo, 'households-empty');

    await page.getByLabel('اسم المنزل').fill('دار بنعلي');
    await page.getByRole('button', { name: 'إنشاء المنزل' }).click();
    await expect(page.getByRole('heading', { name: 'دار بنعلي', level: 1 })).toBeVisible();
    await expect(page.getByText('عضو واحد')).toHaveCount(0); // members list, not count text
    await checkPage(page, testInfo, 'household');

    if (!isMobile) {
      // The sidebar sits on the right in Arabic.
      const sidebar = page.getByRole('navigation', { name: 'التنقل الرئيسي' }).first();
      const box = await sidebar.boundingBox();
      expect(box.x).toBeGreaterThan(page.viewportSize().width / 2);
    }
  });
});
