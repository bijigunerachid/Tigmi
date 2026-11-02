/**
 * Security tunables in one place. createApp() accepts overrides so tests can use
 * small limits (e.g. 3 login attempts) without waiting 15 minutes.
 */
export const DEFAULT_SECURITY_CONFIG = Object.freeze({
  accessTokenTtlSeconds: 15 * 60,
  sessionTtlSeconds: 30 * 24 * 60 * 60,
  /**
   * Two browser tabs may refresh at the same moment with the same token. If the token
   * was rotated less than this long ago, answer 409 (retry) instead of treating it as theft.
   */
  refreshReuseGraceSeconds: 10,
  maxFailedLogins: 5,
  lockoutSeconds: 15 * 60,
  rateLimits: {
    global: { windowSeconds: 60, limit: 300 },
    login: { windowSeconds: 15 * 60, limit: 10 },
    register: { windowSeconds: 60 * 60, limit: 5 },
    refresh: { windowSeconds: 15 * 60, limit: 60 },
  },
  cookies: {
    refreshToken: 'tigmi_rt',
    csrfToken: 'tigmi_csrf',
    refreshTokenPath: '/api/v1/auth',
  },
});

export function createSecurityConfig(overrides = {}) {
  return Object.freeze({
    ...DEFAULT_SECURITY_CONFIG,
    ...overrides,
    rateLimits: { ...DEFAULT_SECURITY_CONFIG.rateLimits, ...overrides.rateLimits },
    cookies: { ...DEFAULT_SECURITY_CONFIG.cookies, ...overrides.cookies },
  });
}
