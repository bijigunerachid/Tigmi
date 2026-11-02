import { hasPermission } from '../modules/households/permissions.js';
import { AppError, forbidden } from '../utils/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const householdNotFound = () =>
  new AppError(404, 'HOUSEHOLD_NOT_FOUND', 'Household not found');

/**
 * Guards every /households/:householdId/... route. Must run after `authenticate`.
 *
 * The household id comes from the URL, so it is untrusted: membership and role are always read
 * from the database for the authenticated user. Non-members get 404 (not 403) so the API never
 * confirms that someone else's household exists.
 *
 * Sets req.household = { id, role, memberId }.
 */
export function createHouseholdAccess({ prisma }) {
  return function requireHouseholdPermission(permission) {
    return async (req, res, next) => {
      const { householdId } = req.params;
      if (!UUID.test(householdId ?? '')) return next(householdNotFound());

      const membership = await prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId, userId: req.auth.userId } },
        select: { id: true, role: true },
      });
      if (!membership) return next(householdNotFound());
      if (!hasPermission(membership.role, permission)) {
        return next(forbidden('FORBIDDEN', 'Your role does not allow this action'));
      }

      req.household = { id: householdId, role: membership.role, memberId: membership.id };
      next();
    };
  };
}
