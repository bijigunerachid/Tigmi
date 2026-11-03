import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, snap } from './helpers.js';

/**
 * Real-browser checks of the design system on the development-only gallery (/dev/ui).
 * jsdom cannot test these: focus trapping in <dialog>, Escape, real fonts, layout.
 */
test.describe('Design system (component gallery)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { name: 'Design system', level: 1 })).toBeVisible();
  });

  test('is accessible, does not scroll sideways, and uses the brand fonts', async ({
    page,
  }, testInfo) => {
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    const interLoaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px "Inter Variable"');
    });
    expect(interLoaded).toBe(true);
    await snap(page, testInfo, 'design-system');
  });

  test('modal: traps focus, closes on Escape and returns focus to its button', async ({
    page,
  }, testInfo) => {
    const opener = page.getByRole('button', { name: 'Ouvrir une fenêtre' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Nouvelle dépense' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await snap(page, testInfo, 'modal');

    // Tab many times: the page behind is inert, so focus is either inside the dialog or (past the
    // last control) in the browser's own UI — never on page content behind the dialog.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const where = await dialog.evaluate((node) => {
        const active = document.activeElement;
        if (!active || active === document.body) return 'browser';
        return node.contains(active) ? 'dialog' : 'page';
      });
      expect(where).not.toBe('page');
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('confirm dialog starts on the safe button', async ({ page }) => {
    await page.getByRole('button', { name: 'Supprimer…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Supprimer cette facture ?' });
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
    await page.keyboard.press('Enter'); // reflex Enter = cancel, nothing deleted
    await expect(dialog).toBeHidden();
  });

  test('drawer slides in from the end edge', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: 'Ouvrir un panneau' }).click();
    const drawer = page.getByRole('dialog', { name: 'Filtres' });
    await expect(drawer).toBeVisible();
    // Measure after the slide-in animation, not halfway through it.
    await drawer.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
    const box = await drawer.boundingBox();
    const viewport = page.viewportSize();
    expect(Math.round(box.x + box.width)).toBe(viewport.width); // anchored to the right in LTR
    await snap(page, testInfo, 'drawer');
    await drawer.getByRole('button', { name: 'Fermer' }).click();
    await expect(drawer).toBeHidden();
  });

  test('menu and tabs work with the keyboard', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Actions de la facture' });
    await menuButton.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Modifier' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Supprimer' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(menuButton).toBeFocused();

    await page.getByRole('tab', { name: 'Mois' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Semaine' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tabpanel')).toHaveText('Vue hebdomadaire.');
  });

  test('table sorts and paginates; phones get cards', async ({ page, isMobile }) => {
    if (isMobile) {
      await expect(page.getByRole('table')).toBeHidden();
      await expect(page.getByRole('list', { name: 'Factures' }).getByRole('listitem')).toHaveCount(
        5,
      );
      await page.getByRole('button', { name: 'Suivant' }).click();
      await expect(page.getByText('Page 2 sur 5')).toBeVisible();
      return;
    }
    const amountHeader = page.getByRole('columnheader', { name: /Montant/ });
    await amountHeader.getByRole('button').click();
    await expect(amountHeader).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('toast appears in the live region', async ({ page }) => {
    await page.getByRole('button', { name: 'Notification' }).click();
    await expect(page.getByRole('list', { name: 'Notifications' })).toContainText(
      'Dépense enregistrée.',
    );
  });
});
