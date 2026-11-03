/** Stable action names. Add new ones here so they stay searchable and consistent. */
export const AUDIT_ACTIONS = Object.freeze({
  REGISTER: 'auth.register',
  REGISTER_EXISTING_EMAIL: 'auth.register_existing_email',
  EMAIL_VERIFIED: 'auth.email_verified',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET: 'auth.password_reset',
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  ACCOUNT_LOCKED: 'auth.account_locked',
  LOGOUT: 'auth.logout',
  REFRESH_TOKEN_REUSE: 'auth.refresh_token_reuse',
  HOUSEHOLD_CREATED: 'household.created',
  HOUSEHOLD_UPDATED: 'household.updated',
  HOUSEHOLD_DELETED: 'household.deleted',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  INVITATION_SENT: 'invitation.sent',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_ACCEPTED: 'invitation.accepted',
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
