import { request } from '@playwright/test';
import { PASSWORD, tokenFromInbox, uniqueEmail } from './helpers.js';

/**
 * Warm-up before the parallel browsers start. The first use of each kind of query makes Prisma
 * prepare it, and Vite compiles modules on first request; when four workers do all of that at
 * the same instant, the first sign-ups took 10–12 s (measured). One sequential pass removes the
 * cold start so tests measure the app, not the warm-up.
 */
export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  const api = await request.newContext({ baseURL });
  try {
    await api.get('/');
    await api.get('/src/main.jsx');
    const email = uniqueEmail('warmup');
    await api.post('/api/v1/auth/register', {
      data: { fullName: 'Warm Up', email, password: PASSWORD },
    });
    const token = await tokenFromInbox(api, email, 'verify-email');
    await api.post('/api/v1/auth/verify-email', { data: { token } });
    const login = await api.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
    const { accessToken } = (await login.json()).data;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const created = await api.post('/api/v1/households', { headers, data: { name: 'Warm up' } });
    const { household } = (await created.json()).data;
    await api.get(`/api/v1/households/${household.id}/members`, { headers });
    await api.post('/api/v1/auth/forgot-password', { data: { email } });
  } finally {
    await api.dispose();
  }
}
