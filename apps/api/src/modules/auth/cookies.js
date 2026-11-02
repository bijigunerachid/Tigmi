/**
 * Web clients keep the refresh token in an HttpOnly cookie (unreadable by JavaScript, so XSS
 * cannot steal it) limited to /api/v1/auth. The CSRF cookie is readable on purpose: the web app
 * copies it into the X-CSRF-Token header ("double-submit"), which a foreign site cannot do.
 */
export function createAuthCookies({ cookieNames, secure }) {
  const base = { secure, sameSite: 'strict' };

  return {
    set(res, { refreshToken, csrfToken, expiresAt }) {
      const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
      res.cookie(cookieNames.refreshToken, refreshToken, {
        ...base,
        httpOnly: true,
        path: cookieNames.refreshTokenPath,
        maxAge,
      });
      res.cookie(cookieNames.csrfToken, csrfToken, { ...base, httpOnly: false, path: '/', maxAge });
    },

    clear(res) {
      res.clearCookie(cookieNames.refreshToken, {
        ...base,
        httpOnly: true,
        path: cookieNames.refreshTokenPath,
      });
      res.clearCookie(cookieNames.csrfToken, { ...base, path: '/' });
    },
  };
}
