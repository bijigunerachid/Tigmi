import { AUDIT_ACTIONS } from '../audit/audit.service.js';
import { badRequest } from '../../utils/errors.js';
import { toPublicHousehold } from './households.serializer.js';

export function createHouseholdsService({ prisma, audit }) {
  return {
    /** The creator becomes the first OWNER, in the same transaction. */
    async create(userId, data, client) {
      return prisma.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: { ...data, members: { create: { userId, role: 'OWNER' } } },
        });
        await audit.record(
          {
            action: AUDIT_ACTIONS.HOUSEHOLD_CREATED,
            userId,
            householdId: household.id,
            entityType: 'Household',
            entityId: household.id,
            ipAddress: client.ipAddress,
          },
          tx,
        );
        return toPublicHousehold(household, 'OWNER', 1);
      });
    },

    async listForUser(userId) {
      const memberships = await prisma.householdMember.findMany({
        where: { userId },
        include: { household: { include: { _count: { select: { members: true } } } } },
        orderBy: { joinedAt: 'asc' },
      });
      return memberships.map((m) =>
        toPublicHousehold(m.household, m.role, m.household._count.members),
      );
    },

    async get(householdId, role) {
      const household = await prisma.household.findUniqueOrThrow({
        where: { id: householdId },
        include: { _count: { select: { members: true } } },
      });
      return toPublicHousehold(household, role, household._count.members);
    },

    async update(householdId, actor, data, client) {
      const household = await prisma.household.update({
        where: { id: householdId },
        data,
        include: { _count: { select: { members: true } } },
      });
      await audit.record({
        action: AUDIT_ACTIONS.HOUSEHOLD_UPDATED,
        userId: actor.userId,
        householdId,
        entityType: 'Household',
        entityId: householdId,
        metadata: { fields: Object.keys(data) },
        ipAddress: client.ipAddress,
      });
      return toPublicHousehold(household, actor.role, household._count.members);
    },

    /** Requires the exact household name, to prevent deleting the wrong home by mistake. */
    async remove(householdId, actor, confirmName, client) {
      const household = await prisma.household.findUniqueOrThrow({ where: { id: householdId } });
      if (confirmName !== household.name) {
        throw badRequest('CONFIRMATION_MISMATCH', 'The household name does not match');
      }
      await prisma.household.delete({ where: { id: householdId } });
      await audit.record({
        action: AUDIT_ACTIONS.HOUSEHOLD_DELETED,
        userId: actor.userId,
        householdId,
        entityType: 'Household',
        entityId: householdId,
        metadata: { name: household.name },
        ipAddress: client.ipAddress,
      });
    },
  };
}
