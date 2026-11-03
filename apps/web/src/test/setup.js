import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setAccessToken } from '../lib/api-client.js';
import '../lib/i18n.js';

afterEach(() => {
  cleanup();
  setAccessToken(null);
  document.cookie = 'tigmi_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
