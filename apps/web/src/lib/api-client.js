const API_BASE = '/api/v1';
const CSRF_COOKIE = 'tigmi_csrf';

/** Error carrying the API's machine-readable `code`, translated by `errorMessage()`. */
export class ApiError extends Error {
  constructor({ status, code, message, requestId, payload, retryAfter }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}

/* ------------------------------------------------------------------------------------------
 * Session state
 *
 * The access token lives ONLY in this module's memory: never in localStorage, never in a cookie
 * readable by scripts. A page reload loses it on purpose; `refreshSession()` gets a new one from
 * the HttpOnly refresh cookie, which JavaScript can never read.
 * ---------------------------------------------------------------------------------------- */

let accessToken = null;
let refreshPromise = null;
const signedOutListeners = new Set();

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};

/** Called whenever the session ends unexpectedly (refresh failed, session revoked elsewhere). */
export function onSignedOut(listener) {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

function endSession() {
  const hadSession = accessToken !== null;
  accessToken = null;
  if (hadSession) signedOutListeners.forEach((listener) => listener());
}

export function readCookie(name) {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rawRequest(path, { method = 'GET', body, signal, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' });
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'HTTP_ERROR',
      message: payload?.error?.message ?? `Request failed with status ${response.status}`,
      requestId: payload?.error?.requestId,
      retryAfter: response.headers.get('Retry-After'),
      payload,
    });
  }
  return payload?.data;
}

/**
 * Exchanges the HttpOnly refresh cookie for a new access token.
 *
 * Single-flight: if ten requests discover an expired token at the same moment, they all await
 * the SAME refresh instead of sending ten (which would look like token theft to the server).
 * `409 REFRESH_IN_PROGRESS` means another tab just rotated the cookie: wait and retry with the
 * new cookie the browser now holds.
 *
 * Resolves to the user when signed in, or null when there is no valid session.
 */
export function refreshSession() {
  // `.finally()` callbacks always run asynchronously, so the reset happens AFTER the assignment.
  // (A `try/finally` inside the async function would run first when it returns synchronously,
  // leaving a settled promise cached forever — every later refresh would return stale null.)
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const csrfToken = readCookie(CSRF_COOKIE);
    if (!csrfToken) {
      endSession();
      return null;
    }
    try {
      const data = await rawRequest('/auth/refresh', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      accessToken = data.accessToken;
      return data.user;
    } catch (error) {
      if (error.code === 'REFRESH_IN_PROGRESS') {
        await sleep(300 * (attempt + 1));
        continue;
      }
      if (error.status === 0) throw error; // offline: keep the session, report the error
      endSession();
      return null;
    }
  }
  endSession();
  return null;
}

/**
 * Calls the Tigmi API and returns the `data` field of a successful response.
 * Sends the access token; on an expired token, refreshes once and retries the request.
 */
export async function apiRequest(path, { method = 'GET', body, signal, auth = true } = {}) {
  const withAuth = () =>
    rawRequest(path, {
      method,
      body,
      signal,
      headers: auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

  try {
    return await withAuth();
  } catch (error) {
    if (!auth || error.status !== 401) throw error;
    if (error.code === 'INVALID_ACCESS_TOKEN') {
      const user = await refreshSession();
      if (user) return withAuth();
    } else {
      endSession(); // SESSION_REVOKED / UNAUTHENTICATED: the session is gone
    }
    throw error;
  }
}
