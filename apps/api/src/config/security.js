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
  emailVerificationTtlSeconds: 24 * 60 * 60,
  passwordResetTtlSeconds: 60 * 60,
  /** At most one verification/reset email per account per minute (anti email-bombing). */
  emailCooldownSeconds: 60,
  invitationTtlSeconds: 7 * 24 * 60 * 60,
  /** Members + pending invitations per household (anti-abuse; generous for a family). */
  maxHouseholdMembers: 50,
  rateLimits: {
    global: { windowSeconds: 60, limit: 300 },
    login: { windowSeconds: 15 * 60, limit: 10 },
    register: { windowSeconds: 60 * 60, limit: 5 },
    refresh: { windowSeconds: 15 * 60, limit: 60 },
    emailRequest: { windowSeconds: 60 * 60, limit: 5 },
    tokenSubmit: { windowSeconds: 15 * 60, limit: 20 },
    invite: { windowSeconds: 60 * 60, limit: 30 },
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
