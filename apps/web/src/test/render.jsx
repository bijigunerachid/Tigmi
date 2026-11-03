import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { routes } from '../app/App.jsx';
import { AppProviders } from '../app/providers.jsx';

export const json = (status, body) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const apiError = (status, code, extra = {}) =>
  json(status, { error: { code, message: code, requestId: 'test', ...extra } });

/**
 * Replaces fetch with a tiny fake API. `handlers` maps "METHOD /path" (without /api/v1) to
 * (body, init) => Response. Unknown calls fail the test loudly. Returns the vi.fn for assertions.
 */
export function mockApi(handlers) {
  const fetchMock = vi.fn(async (url, init = {}) => {
    const path = String(url).replace(/^\/api\/v1/, '');
    const key = `${init.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected API call in test: ${key}`);
    const body = init.body ? JSON.parse(init.body) : undefined;
    return handler(body, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const signedInUser = {
  id: '0195f0a0-0000-7000-8000-000000000001',
  fullName: 'Amina Benali',
  email: 'amina@example.com',
  avatarUrl: null,
  preferredLanguage: 'fr',
  emailVerified: true,
  createdAt: '2026-11-01T10:00:00.000Z',
};

/** Simulates (or not) the readable CSRF cookie that marks an existing browser session. */
export function setSessionCookie(present) {
  document.cookie = present
    ? 'tigmi_csrf=test-csrf-token; path=/'
    : 'tigmi_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

/** Renders the real route tree at `path` (with hash), inside StrictMode like the real app. */
export function renderRoute(path) {
  const url = new URL(path, 'http://localhost');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  const router = createMemoryRouter(routes, { initialEntries: [url.pathname + url.search] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <StrictMode>
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
  return { ...utils, router };
}
