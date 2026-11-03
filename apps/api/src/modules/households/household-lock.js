/**
 * Locks the household row until the surrounding transaction ends. Membership changes and
 * invitations for the same household then run one after another, so invariants such as
 * "at least one owner" or "at most N members" cannot be broken by concurrent requests.
 */
export const lockHousehold = (tx, householdId) =>
  tx.$queryRaw`SELECT id FROM households WHERE id = ${householdId}::uuid FOR UPDATE`;
