import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setAccessToken } from '../lib/api-client.js';
import i18n from '../lib/i18n.js';

// jsdom has no <dialog> methods. This stand-in only toggles `open`; real modal behaviour
// (focus trap, Escape, inert page) is verified in a real browser by the Playwright tests.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  setAccessToken(null);
  document.cookie = 'tigmi_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  window.sessionStorage.clear();
  window.localStorage.clear();
  // Every test starts in French, even if a previous one switched language and then failed.
  i18n.changeLanguage('fr');
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
