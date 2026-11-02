import { ROLE_PERMISSIONS } from './permissions.js';

/**
 * Public shape of a household for the current user. `myRole` and `permissions` let the web and
 * mobile apps hide actions the user cannot perform (the API still enforces them).
 */
export function toPublicHousehold(household, role, memberCount) {
  return {
    id: household.id,
    name: household.name,
    description: household.description,
    currency: household.currency,
    timezone: household.timezone,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
    myRole: role,
    permissions: [...ROLE_PERMISSIONS[role]],
    ...(memberCount !== undefined && { memberCount }),
  };
}

export function toPublicMember(member) {
  return {
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: {
      id: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
    },
  };
}
