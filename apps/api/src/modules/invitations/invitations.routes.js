import { createInvitationSchema, invitationTokenSchema } from '@tigmi/validation';
import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { validateBody } from '../../middleware/validate.js';
import { PERMISSIONS as P } from '../households/permissions.js';
import { createInvitationsController } from './invitations.controller.js';
import { createInvitationsService } from './invitations.service.js';

/**
 * Two routers:
 *  - household-scoped management (mounted under /households/:householdId/invitations), guarded by
 *    the `members:invite` permission;
 *  - /invitations/preview and /invitations/accept for the invitee, who is not a member yet.
 */
export function createInvitationRouters({ prisma, audit, mail, config, authenticate, can }) {
  const controller = createInvitationsController({
    invitationsService: createInvitationsService({ prisma, audit, mail, config }),
  });
  const tokenLimiter = createRateLimiter(config.rateLimits.tokenSubmit);

  const householdScoped = Router({ mergeParams: true });
  householdScoped.post(
    '/',
    can(P.MEMBERS_INVITE),
    createRateLimiter(config.rateLimits.invite),
    validateBody(createInvitationSchema),
    controller.create,
  );
  householdScoped.get('/', can(P.MEMBERS_INVITE), controller.list);
  householdScoped.delete('/:invitationId', can(P.MEMBERS_INVITE), controller.revoke);

  const forInvitee = Router();
  forInvitee.post(
    '/preview',
    tokenLimiter,
    validateBody(invitationTokenSchema),
    controller.preview,
  );
  forInvitee.post(
    '/accept',
    authenticate,
    tokenLimiter,
    validateBody(invitationTokenSchema),
    controller.accept,
  );

  return { householdScoped, forInvitee };
}
