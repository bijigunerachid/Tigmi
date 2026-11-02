import { AUDIT_ACTIONS } from '../audit/audit.service.js';
import { AppError, conflict, forbidden } from '../../utils/errors.js';
import { householdNotFound } from '../../middleware/household-access.js';
import { toPublicMember } from './households.serializer.js';
import { PERMISSIONS, canManageMember, hasPermission } from './permissions.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const memberNotFound = () => new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
const lastOwner = () =>
  conflict('LAST_OWNER', 'A household must keep at least one owner. Promote someone else first.');
const notAllowed = () => forbidden('FORBIDDEN', 'Your role does not allow this action');

const includeUser = {
  user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
};

/**
 * Locks the household row until the transaction ends. Concurrent role changes and removals in the
 * same household then run one after another, so "at least one owner" cannot be broken by two
 * owners demoting each other at the same instant.
 */
const lockHousehold = (tx, householdId) =>
  tx.$queryRaw`SELECT id FROM households WHERE id = ${householdId}::uuid FOR UPDATE`;

export function createMembersService({ prisma, audit }) {
  /** Locks, then re-reads actor and target inside the transaction (no stale roles). */
  async function loadForChange(tx, householdId, actorUserId, memberId) {
    await lockHousehold(tx, householdId);
    const actor = await tx.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: actorUserId } },
    });
    if (!actor) throw householdNotFound(); // removed meanwhile
    if (!UUID.test(memberId)) throw memberNotFound();
    const target = await tx.householdMember.findFirst({ where: { id: memberId, householdId } });
    if (!target) throw memberNotFound();
    return { actor, target };
  }

  const countOwners = (tx, householdId) =>
    tx.householdMember.count({ where: { householdId, role: 'OWNER' } });

  return {
    async list(householdId) {
      const members = await prisma.householdMember.findMany({
        where: { householdId },
        include: includeUser,
        // Postgres orders enums by declaration: OWNER, ADMIN, MEMBER.
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      return members.map(toPublicMember);
    },

    async changeRole(householdId, actorUserId, memberId, newRole, client) {
      return prisma.$transaction(async (tx) => {
        const { actor, target } = await loadForChange(tx, householdId, actorUserId, memberId);

        if (!hasPermission(actor.role, PERMISSIONS.MEMBERS_MANAGE)) throw notAllowed();
        if (!canManageMember(actor.role, target.role, newRole)) throw notAllowed();

        if (target.role !== newRole) {
          if (target.role === 'OWNER' && (await countOwners(tx, householdId)) === 1) {
            throw lastOwner();
          }
          await tx.householdMember.update({ where: { id: target.id }, data: { role: newRole } });
          await audit.record(
            {
              action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
              userId: actorUserId,
              householdId,
              entityType: 'HouseholdMember',
              entityId: target.id,
              metadata: { targetUserId: target.userId, from: target.role, to: newRole },
              ipAddress: client.ipAddress,
            },
            tx,
          );
        }

        const updated = await tx.householdMember.findUniqueOrThrow({
          where: { id: target.id },
          include: includeUser,
        });
        return toPublicMember(updated);
      });
    },

    /** Removing yourself = leaving (any role). Removing someone else follows the hierarchy. */
    async remove(householdId, actorUserId, memberId, client) {
      await prisma.$transaction(async (tx) => {
        const { actor, target } = await loadForChange(tx, householdId, actorUserId, memberId);
        const leaving = actor.id === target.id;

        if (!leaving) {
          if (!hasPermission(actor.role, PERMISSIONS.MEMBERS_MANAGE)) throw notAllowed();
          if (!canManageMember(actor.role, target.role)) throw notAllowed();
        }
        if (target.role === 'OWNER' && (await countOwners(tx, householdId)) === 1) {
          throw lastOwner();
        }

        await tx.householdMember.delete({ where: { id: target.id } });
        await audit.record(
          {
            action: leaving ? AUDIT_ACTIONS.MEMBER_LEFT : AUDIT_ACTIONS.MEMBER_REMOVED,
            userId: actorUserId,
            householdId,
            entityType: 'HouseholdMember',
            entityId: target.id,
            metadata: { targetUserId: target.userId, role: target.role },
            ipAddress: client.ipAddress,
          },
          tx,
        );
      });
    },
  };
}
