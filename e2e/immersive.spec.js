import { expect, test } from '@playwright/test';
import { expectAccessible, snap } from './helpers.js';

test.describe('3D hero and mobile gestures', () => {
  test('without a real GPU, the hero stays the lightweight SVG (no Three.js download)', async ({
    page,
  }) => {
    // Headless browsers render WebGL in software: exactly the case that must fall back.
    const threeRequests = [];
    page.on('request', (request) => {
      if (/HouseScene3D|node_modules\/\.vite\/deps\/three/.test(request.url())) {
        threeRequests.push(request.url());
      }
    });
    await page.goto('/login');
    await expect(page.locator('[data-hero]').first()).toHaveAttribute('data-hero', 'svg');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(threeRequests).toEqual([]);
  });

  test('sign-in hero: real 3D on desktop, code-drawn SVG on phones (Three.js never loaded)', async ({
    page,
    isMobile,
  }, testInfo) => {
    // Development-only flag: run the 3D path even on this software-rendered test browser.
    await page.addInitScript(() => window.localStorage.setItem('tigmi.hero', '3d'));
    const threeRequests = [];
    page.on('request', (request) => {
      if (/HouseScene3D|node_modules\/\.vite\/deps\/three/.test(request.url())) {
        threeRequests.push(request.url());
      }
    });

    await page.goto('/login');
    const hero = page.locator('[data-hero]').first();

    if (isMobile) {
      await expect(page.locator('[data-hero]')).toHaveCount(1); // desktop panel stays hidden
      await expect(hero).toHaveAttribute('data-hero', 'svg');
      await expect(page.locator('canvas')).toHaveCount(0);
      expect(threeRequests).toEqual([]);
    } else {
      await expect(hero).toHaveAttribute('data-hero', '3d');
      const canvas = hero.locator('canvas');
      await expect(canvas).toHaveCount(1);
      // The scene cross-fades in once its first frame has rendered.
      await expect(canvas.locator('..')).toHaveClass(/opacity-100/);
      expect(threeRequests.length).toBeGreaterThan(0);
      await page.mouse.move(200, 120); // the house leans toward the pointer
    }
    await expectAccessible(page);
    await snap(page, testInfo, 'hero');
  });

  test('phone dialogs are bottom sheets: a long drag down closes, a small drag springs back', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Bottom sheets are a phone layout');
    await page.goto('/dev/ui');
    const opener = page.getByRole('button', { name: 'Ouvrir une fenêtre' });
    const sheet = page.getByRole('dialog', { name: 'Nouvelle dépense' });

    await opener.click();
    await expect(sheet).toBeVisible();
    // Measure after the slide-up animation, not during it.
    await sheet.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
    const box = await sheet.boundingBox();
    const viewport = page.viewportSize();
    expect(Math.round(box.y + box.height)).toBe(viewport.height); // anchored to the bottom

    const handle = { x: box.x + box.width / 2, y: box.y + 10 };

    // Small, slow drag: springs back, stays open.
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, handle.y + 30, { steps: 10 });
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(sheet).toBeVisible();

    // Long drag past 30 % of the sheet: closes. (The quick-flick velocity rule is unit-tested with
    // a controlled clock: real-time velocity in a loaded test browser is not deterministic.)
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, handle.y + box.height * 0.6, { steps: 12 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused(); // focus returns, as with Escape
  });
});
