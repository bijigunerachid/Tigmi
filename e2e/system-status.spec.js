import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('System status page', () => {
  test('shows the API and database as healthy (real API + real database)', async ({
    page,
  }, testInfo) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Tigmi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tigmi.');
    await expect(page.getByText('Opérationnelle')).toBeVisible();
    await expect(page.getByText('Connectée')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // Layout: nothing may overflow horizontally (common mobile bug).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await page.screenshot({
      path: testInfo.outputPath(`system-status-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Connectée')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('shows an error when the API is unreachable, then recovers on retry', async ({ page }) => {
    let failNext = true;
    await page.route('**/api/v1/health', (route) =>
      failNext ? route.abort('connectionrefused') : route.continue(),
    );

    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('Injoignable');

    failNext = false;
    await page.getByRole('button', { name: 'Réessayer' }).click();

    await expect(page.getByText('Connectée')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
