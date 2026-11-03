/**
 * Role-based access control for household data.
 *
 * Routes ask for a *permission* (e.g. "household:update"), never for a role. Adding a role or
 * moving a capability between roles is a change to this map only — routes stay the same.
 * Later modules (finance, tasks, …) add their permissions here.
 */
export const PERMISSIONS = Object.freeze({
  HOUSEHOLD_READ: 'household:read',
  HOUSEHOLD_UPDATE: 'household:update',
  HOUSEHOLD_DELETE: 'household:delete',
  MEMBERS_READ: 'members:read',
  MEMBERS_MANAGE: 'members:manage',
  MEMBERS_INVITE: 'members:invite',
});

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = Object.freeze({
  OWNER: Object.freeze(Object.values(P)),
  ADMIN: Object.freeze([P.HOUSEHOLD_READ, P.MEMBERS_READ, P.MEMBERS_MANAGE, P.MEMBERS_INVITE]),
  MEMBER: Object.freeze([P.HOUSEHOLD_READ, P.MEMBERS_READ]),
});

/** Higher rank = more authority. Used for "who may manage whom". */
export const ROLE_RANK = Object.freeze({ OWNER: 3, ADMIN: 2, MEMBER: 1 });

export const hasPermission = (role, permission) =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

/**
 * Hierarchy rule for changing or removing another member:
 *  - owners may manage anyone (the last-owner rule is enforced separately);
 *  - everyone else may only manage members ranked strictly below them,
 *    and may only assign roles ranked strictly below their own.
 * So an ADMIN can manage MEMBERs, but cannot touch other admins or owners, or create admins.
 */
export function canManageMember(actorRole, targetRole, newRole) {
  if (actorRole === 'OWNER') return true;
  if (!canAssignRole(actorRole, targetRole)) return false;
  return newRole === undefined || canAssignRole(actorRole, newRole);
}

/** Owners may give any role; others only roles ranked strictly below their own. */
export function canAssignRole(actorRole, role) {
  if (actorRole === 'OWNER') return true;
  return (ROLE_RANK[role] ?? Infinity) < (ROLE_RANK[actorRole] ?? 0);
}
