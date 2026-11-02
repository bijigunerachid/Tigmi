import {
  createHouseholdSchema,
  deleteHouseholdSchema,
  updateHouseholdSchema,
  updateMemberRoleSchema,
} from '@tigmi/validation';
import { Router } from 'express';
import { createHouseholdAccess } from '../../middleware/household-access.js';
import { validateBody } from '../../middleware/validate.js';
import { createHouseholdsController } from './households.controller.js';
import { createHouseholdsService } from './households.service.js';
import { createMembersService } from './members.service.js';
import { PERMISSIONS as P } from './permissions.js';

export function createHouseholdsRouter({ prisma, audit, authenticate }) {
  const controller = createHouseholdsController({
    householdsService: createHouseholdsService({ prisma, audit }),
    membersService: createMembersService({ prisma, audit }),
  });
  const can = createHouseholdAccess({ prisma });

  const router = Router();
  router.use(authenticate);

  router.post('/', validateBody(createHouseholdSchema), controller.create);
  router.get('/', controller.list);

  router.get('/:householdId', can(P.HOUSEHOLD_READ), controller.get);
  router.patch(
    '/:householdId',
    can(P.HOUSEHOLD_UPDATE),
    validateBody(updateHouseholdSchema),
    controller.update,
  );
  router.delete(
    '/:householdId',
    can(P.HOUSEHOLD_DELETE),
    validateBody(deleteHouseholdSchema),
    controller.remove,
  );

  router.get('/:householdId/members', can(P.MEMBERS_READ), controller.listMembers);
  router.patch(
    '/:householdId/members/:memberId',
    can(P.MEMBERS_MANAGE),
    validateBody(updateMemberRoleSchema),
    controller.changeMemberRole,
  );
  // Any member may remove themselves (leave); removing others is checked in the service.
  router.delete('/:householdId/members/:memberId', can(P.HOUSEHOLD_READ), controller.removeMember);

  return router;
}
