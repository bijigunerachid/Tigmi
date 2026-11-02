import { expect, test } from '@playwright/test';
import { signUp } from './helpers.js';

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
});
