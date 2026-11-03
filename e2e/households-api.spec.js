import { expect, test } from '@playwright/test';
import { signUp, tokenFromInbox, uniqueEmail } from './helpers.js';

// API journey (screens arrive in later steps): real users, real email verification, real DB.
test.describe('Household journey (HTTP)', () => {
  test.skip(({ isMobile }) => isMobile, 'HTTP-only journey: running once is enough');

  test('create a household, rename it, and keep it private from other users', async ({
    playwright,
    baseURL,
  }) => {
    // Two independent API clients = two people on two devices.
    const amina = await playwright.request.newContext({ baseURL });
    const youssef = await playwright.request.newContext({ baseURL });
    const ownerSession = await signUp(amina, { fullName: 'Amina' });
    const otherSession = await signUp(youssef, { fullName: 'Youssef' });

    const created = await amina.post('/api/v1/households', {
      headers: ownerSession.headers,
      data: { name: 'Dar Benali' },
    });
    expect(created.status()).toBe(201);
    const { household } = (await created.json()).data;
    expect(household).toMatchObject({ myRole: 'OWNER', currency: 'MAD' });

    const renamed = await amina.patch(`/api/v1/households/${household.id}`, {
      headers: ownerSession.headers,
      data: { name: 'Dar Benali — Rabat' },
    });
    expect((await renamed.json()).data.household.name).toBe('Dar Benali — Rabat');

    const list = await amina.get('/api/v1/households', { headers: ownerSession.headers });
    expect((await list.json()).data.households.map((h) => h.id)).toContain(household.id);

    // Someone else cannot see or change it — and cannot even tell it exists.
    const peek = await youssef.get(`/api/v1/households/${household.id}`, {
      headers: otherSession.headers,
    });
    expect(peek.status()).toBe(404);
    const theirList = await youssef.get('/api/v1/households', { headers: otherSession.headers });
    expect((await theirList.json()).data.households).toEqual([]);

    await amina.dispose();
    await youssef.dispose();
  });

  test('invite a new person by email; they sign up and join', async ({ playwright, baseURL }) => {
    const amina = await playwright.request.newContext({ baseURL });
    const youssef = await playwright.request.newContext({ baseURL });
    const ownerSession = await signUp(amina, { fullName: 'Amina' });

    const { household } = (
      await (
        await amina.post('/api/v1/households', {
          headers: ownerSession.headers,
          data: { name: 'Dar Benali' },
        })
      ).json()
    ).data;

    // Youssef has no account yet.
    const youssefEmail = uniqueEmail('youssef');
    const sent = await amina.post(`/api/v1/households/${household.id}/invitations`, {
      headers: ownerSession.headers,
      data: { email: youssefEmail, role: 'ADMIN' },
    });
    expect(sent.status()).toBe(201);

    // He opens the link from his real inbox and sees who invites him, before signing up.
    const token = await tokenFromInbox(youssef, youssefEmail, 'invitations/accept');
    const preview = await youssef.post('/api/v1/invitations/preview', { data: { token } });
    expect((await preview.json()).data.invitation).toMatchObject({
      householdName: 'Dar Benali',
      invitedBy: 'Amina',
      role: 'ADMIN',
    });

    // Signs up with the invited address (email verification included), then accepts.
    const youssefSession = await signUp(youssef, { fullName: 'Youssef', email: youssefEmail });
    const accepted = await youssef.post('/api/v1/invitations/accept', {
      headers: youssefSession.headers,
      data: { token },
    });
    expect(accepted.status()).toBe(200);
    expect((await accepted.json()).data.household).toMatchObject({ myRole: 'ADMIN' });

    const members = await amina.get(`/api/v1/households/${household.id}/members`, {
      headers: ownerSession.headers,
    });
    expect((await members.json()).data.members.map((m) => m.user.fullName)).toEqual([
      'Amina',
      'Youssef',
    ]);

    await amina.dispose();
    await youssef.dispose();
  });
});
