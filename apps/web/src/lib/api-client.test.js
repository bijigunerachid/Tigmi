import { vi } from 'vitest';
import { apiError, json, mockApi, setSessionCookie, signedInUser } from '../test/render.jsx';
import {
  apiRequest,
  getAccessToken,
  onSignedOut,
  refreshSession,
  setAccessToken,
} from './api-client.js';

const refreshed = (token = 'new-access-token') =>
  json(200, { data: { user: signedInUser, accessToken: token, csrfToken: 'test-csrf-token' } });

describe('apiRequest', () => {
  it('sends the access token and returns the data field', async () => {
    setAccessToken('token-1');
    const fetchMock = mockApi({ 'GET /households': () => json(200, { data: { households: [] } }) });

    await expect(apiRequest('/households')).resolves.toEqual({ households: [] });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('refreshes once on an expired token and retries the request', async () => {
    setAccessToken('expired');
    setSessionCookie(true);
    let calls = 0;
    const fetchMock = mockApi({
      'GET /households': (body, init) => {
        calls += 1;
        return init.headers.Authorization === 'Bearer new-access-token'
          ? json(200, { data: { households: ['ok'] } })
          : apiError(401, 'INVALID_ACCESS_TOKEN');
      },
      'POST /auth/refresh': () => refreshed(),
    });

    await expect(apiRequest('/households')).resolves.toEqual({ households: ['ok'] });
    expect(calls).toBe(2);
    expect(getAccessToken()).toBe('new-access-token');
    const refreshCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/refresh'));
    expect(refreshCall[1].headers['X-CSRF-Token']).toBe('test-csrf-token');
  });

  it('shares ONE refresh between simultaneous requests (no false theft alarm)', async () => {
    setAccessToken('expired');
    setSessionCookie(true);
    const fetchMock = mockApi({
      'GET /a': (b, init) =>
        init.headers.Authorization === 'Bearer new-access-token'
          ? json(200, { data: 'a' })
          : apiError(401, 'INVALID_ACCESS_TOKEN'),
      'GET /b': (b, init) =>
        init.headers.Authorization === 'Bearer new-access-token'
          ? json(200, { data: 'b' })
          : apiError(401, 'INVALID_ACCESS_TOKEN'),
      'POST /auth/refresh': () => refreshed(),
    });

    await expect(Promise.all([apiRequest('/a'), apiRequest('/b')])).resolves.toEqual(['a', 'b']);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('ends the session when the refresh fails, and reports it to listeners', async () => {
    setAccessToken('expired');
    setSessionCookie(true);
    const listener = vi.fn();
    const unsubscribe = onSignedOut(listener);
    mockApi({
      'GET /households': () => apiError(401, 'INVALID_ACCESS_TOKEN'),
      'POST /auth/refresh': () => apiError(401, 'INVALID_REFRESH_TOKEN'),
    });

    await expect(apiRequest('/households')).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('does not try to refresh a revoked session', async () => {
    setAccessToken('token');
    const listener = vi.fn();
    const unsubscribe = onSignedOut(listener);
    const fetchMock = mockApi({ 'GET /households': () => apiError(401, 'SESSION_REVOKED') });

    await expect(apiRequest('/households')).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('turns network failures into NETWORK_ERROR and exposes Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiRequest('/x', { auth: false })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });

    mockApi({
      'POST /auth/login': () =>
        new Response(JSON.stringify({ error: { code: 'ACCOUNT_LOCKED', message: 'x' } }), {
          status: 429,
          headers: { 'Retry-After': '600' },
        }),
    });
    await expect(
      apiRequest('/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED', retryAfter: '600' });
  });
});

describe('refreshSession', () => {
  it('returns null without calling the API when there is no session cookie', async () => {
    setSessionCookie(false);
    const fetchMock = mockApi({});
    await expect(refreshSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still works after a signed-out page load (regression: stale cached result)', async () => {
    setSessionCookie(false);
    mockApi({});
    await expect(refreshSession()).resolves.toBeNull(); // visitor arrives signed out

    setSessionCookie(true); // …then signs in; later the access token expires
    mockApi({ 'POST /auth/refresh': () => refreshed('fresh') });
    await expect(refreshSession()).resolves.toEqual(signedInUser);
    expect(getAccessToken()).toBe('fresh');
  });

  it('retries after REFRESH_IN_PROGRESS (another tab just refreshed)', async () => {
    setSessionCookie(true);
    let attempt = 0;
    mockApi({
      'POST /auth/refresh': () => {
        attempt += 1;
        return attempt === 1 ? apiError(409, 'REFRESH_IN_PROGRESS') : refreshed('after-retry');
      },
    });

    await expect(refreshSession()).resolves.toEqual(signedInUser);
    expect(attempt).toBe(2);
    expect(getAccessToken()).toBe('after-retry');
  });
});
