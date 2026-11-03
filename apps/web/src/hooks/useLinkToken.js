import { useCallback, useEffect, useState } from 'react';

const TOKEN_PATTERN = /^[\w-]{43}$/;

const tokenFromHash = () => {
  const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
  return value && TOKEN_PATTERN.test(value) ? value : null;
};

/**
 * Reads the secret from an emailed link (`/page#token=…`), then removes it from the address bar
 * so it does not linger in history, screenshots or screen shares (the fragment is never sent to
 * servers). With `persistKey`, the token also survives in this tab's sessionStorage — used by the
 * invitation page while the person signs up and comes back.
 *
 * The state initialiser only READS (React may call it twice in development); removing the hash
 * and persisting happen in an effect.
 */
export function useLinkToken({ persistKey } = {}) {
  const [token] = useState(() => tokenFromHash() ?? (persistKey ? validStored(persistKey) : null));

  useEffect(() => {
    if (!window.location.hash) return;
    if (persistKey && token) safeSession('set', persistKey, token);
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  }, [persistKey, token]);

  const forget = useCallback(() => {
    if (persistKey) safeSession('remove', persistKey);
  }, [persistKey]);

  return { token, forget };
}

function validStored(key) {
  const stored = safeSession('get', key);
  return stored && TOKEN_PATTERN.test(stored) ? stored : null;
}

function safeSession(action, key, value) {
  try {
    if (action === 'set') return window.sessionStorage.setItem(key, value);
    if (action === 'get') return window.sessionStorage.getItem(key);
    return window.sessionStorage.removeItem(key);
  } catch {
    return null; // storage disabled (private mode): the flow still works within this page
  }
}
