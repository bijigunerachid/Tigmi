/** Stable action names. Add new ones here so they stay searchable and consistent. */
export const AUDIT_ACTIONS = Object.freeze({
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  ACCOUNT_LOCKED: 'auth.account_locked',
  LOGOUT: 'auth.logout',
  REFRESH_TOKEN_REUSE: 'auth.refresh_token_reuse',
});

/**
 * Writes append-only audit entries. A failed audit write is logged but never breaks the
 * user's request. Never put secrets (passwords, tokens) in `metadata`.
 */
export function createAuditService({ prisma, logger }) {
  return {
    async record({ action, userId, householdId, entityType, entityId, metadata, ipAddress }, db) {
      try {
        await (db ?? prisma).auditLog.create({
          data: { action, userId, householdId, entityType, entityId, metadata, ipAddress },
        });
      } catch (err) {
        logger.error({ err, action }, 'Failed to write audit log');
      }
    },
  };
}
