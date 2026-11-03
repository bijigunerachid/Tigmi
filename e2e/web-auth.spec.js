import { expect, test } from '@playwright/test';
import {
  PASSWORD,
  expectAccessible,
  expectNoHorizontalOverflow,
  linkPath,
  snap,
  tokenFromInbox,
  uniqueEmail,
} from './helpers.js';

/**
 * Real browser journeys: Chromium at 1366px and 390px, real API, real database, real emails
 * (read back from Mailpit). Each page is also checked for accessibility and sideways scrolling.
 */

async function checkPage(page, testInfo, name) {
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
  await snap(page, testInfo, name);
}

async function signUpThroughUi(page, request, { fullName, email }, testInfo) {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
  if (testInfo) await checkPage(page, testInfo, '01-register');

  await page.getByLabel('Nom complet').fill(fullName);
  const emailField = page.getByLabel('Adresse e-mail');
  if (!(await emailField.inputValue())) await emailField.fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(
    page.getByRole('heading', { name: 'Vérifiez votre boîte de réception' }),
  ).toBeVisible();
  if (testInfo) await checkPage(page, testInfo, '02-check-email');

  const token = await tokenFromInbox(request, email, 'verify-email');
  await page.goto(linkPath('verify-email', token));
  await expect(
    page.getByText('Votre adresse e-mail est confirmée.', { exact: false }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/); // token removed from the address bar
  if (testInfo) await checkPage(page, testInfo, '03-verified');
}

async function signInThroughUi(page, email, password = PASSWORD) {
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('Web authentication and households', () => {
  // Multi-page journeys with real email and several accessibility scans: ~20 s alone, slower
  // when the four workers share the CPU (Argon2 hashing). 30 s default is too tight here.
  test.describe.configure({ timeout: 90_000 });

  test('sign up, verify, sign in, create a household and invite someone', async ({
    page,
    request,
  }, testInfo) => {
    const email = uniqueEmail('amina');
    await signUpThroughUi(page, request, { fullName: 'Amina Benali', email }, testInfo);

    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await checkPage(page, testInfo, '04-login');
    await signInThroughUi(page, email);

    await expect(page.getByRole('heading', { name: 'Mes foyers' })).toBeVisible();
    await expect(page.getByText(/Vous ne faites encore partie d’aucun foyer/)).toBeVisible();
    await checkPage(page, testInfo, '05-households-empty');

    await page.getByLabel('Nom du foyer').fill('Dar Benali');
    await page.getByRole('button', { name: 'Créer le foyer' }).click();
    await expect(page.getByRole('heading', { name: 'Dar Benali', level: 1 })).toBeVisible();

    await page.getByLabel('Adresse e-mail de la personne').fill(uniqueEmail('youssef'));
    await page.getByLabel('Rôle').selectOption('ADMIN');
    await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
    await expect(page.getByText(/Invitation envoyée à/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Invitations en attente' })).toContainText(
      'Administrateur',
    );
    await checkPage(page, testInfo, '06-household');

    // The session survives a page reload (refresh cookie), then sign out ends it.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dar Benali', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('an invited person without an account signs up and joins', async ({
    browser,
    request,
  }, testInfo) => {
    // Amina (owner) prepares a household and invites Youssef — through the API for speed.
    const amina = await browser.newContext();
    const owner = await amina.newPage();
    const ownerEmail = uniqueEmail('amina');
    await signUpThroughUi(owner, request, { fullName: 'Amina Benali', email: ownerEmail });
    await owner.goto('/login');
    await signInThroughUi(owner, ownerEmail);
    await owner.getByLabel('Nom du foyer').fill('Dar Benali');
    await owner.getByRole('button', { name: 'Créer le foyer' }).click();
    const youssefEmail = uniqueEmail('youssef');
    await owner.getByLabel('Adresse e-mail de la personne').fill(youssefEmail);
    await owner.getByRole('button', { name: 'Envoyer l’invitation' }).click();
    await expect(owner.getByText(/Invitation envoyée à/)).toBeVisible();

    // Youssef opens the emailed link in his own browser.
    const youssef = await browser.newContext();
    const page = await youssef.newPage();
    const invitationToken = await tokenFromInbox(request, youssefEmail, 'invitations/accept');
    await page.goto(linkPath('invitations/accept', invitationToken));
    await expect(
      page.getByText('Amina Benali vous invite à rejoindre le foyer « Dar Benali »', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/invitations\/accept$/);
    await checkPage(page, testInfo, '07-invitation');

    // "Create an account" keeps the invited address and brings him back afterwards.
    await page.getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page.getByLabel('Adresse e-mail')).toHaveValue(youssefEmail);
    await page.getByLabel('Nom complet').fill('Youssef Benali');
    await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(
      page.getByRole('heading', { name: 'Vérifiez votre boîte de réception' }),
    ).toBeVisible();

    // He confirms his email from another tab, then returns to this tab and signs in.
    const mailTab = await youssef.newPage();
    const verifyToken = await tokenFromInbox(request, youssefEmail, 'verify-email');
    await mailTab.goto(linkPath('verify-email', verifyToken));
    await expect(
      mailTab.getByText('Votre adresse e-mail est confirmée.', { exact: false }),
    ).toBeVisible();
    await mailTab.close();

    await page.getByRole('link', { name: 'Aller à la connexion' }).click();
    await signInThroughUi(page, youssefEmail);
    await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();

    await expect(page.getByRole('heading', { name: 'Dar Benali', level: 1 })).toBeVisible();
    const members = page.getByRole('region', { name: 'Membres' });
    await expect(members).toContainText('Amina Benali');
    await expect(members).toContainText('Youssef Benali');

    await amina.close();
    await youssef.close();
  });

  test('forgotten password: reset by email, then sign in with the new one', async ({
    page,
    request,
  }, testInfo) => {
    const email = uniqueEmail('reset');
    await signUpThroughUi(page, request, { fullName: 'Reset Test', email });

    await page.goto('/login');
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible();
    await checkPage(page, testInfo, '08-forgot');

    const token = await tokenFromInbox(request, email, 'reset-password');
    await page.goto(linkPath('reset-password', token));
    await page.getByLabel('Nouveau mot de passe').fill('a brand new family passphrase');
    await checkPage(page, testInfo, '09-reset');
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await expect(page.getByText(/Votre mot de passe a été modifié/)).toBeVisible();

    await page.getByRole('link', { name: 'Se connecter' }).click();
    await signInThroughUi(page, email, PASSWORD);
    await expect(page.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect.');
    await signInThroughUi(page, email, 'a brand new family passphrase');
    await expect(page.getByRole('heading', { name: 'Mes foyers' })).toBeVisible();
  });
});
