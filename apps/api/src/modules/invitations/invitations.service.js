import { AUDIT_ACTIONS } from '../audit/audit.service.js';
import { generateOpaqueToken, hashToken } from '../auth/tokens.js';
import { lockHousehold } from '../households/household-lock.js';
import { toPublicHousehold } from '../households/households.serializer.js';
import { PERMISSIONS, canAssignRole, hasPermission } from '../households/permissions.js';
import { householdNotFound } from '../../middleware/household-access.js';
import { AppError, badRequest, conflict, forbidden, tooManyRequests } from '../../utils/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInvitation = () =>
  badRequest('INVALID_OR_EXPIRED_TOKEN', 'This invitation is invalid, expired or already used');
const invitationNotFound = () => new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
const notAllowed = () => forbidden('FORBIDDEN', 'Your role does not allow this action');

const isPending = (invitation, now = new Date()) =>
  !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;

export function toPublicInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.expiresAt > new Date() ? 'pending' : 'expired',
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    invitedBy: invitation.createdBy
      ? { id: invitation.createdBy.id, fullName: invitation.createdBy.fullName }
      : null,
  };
}

const withInviter = { createdBy: { select: { id: true, fullName: true } } };

export function createInvitationsService({ prisma, audit, mail, config }) {
  /** Re-reads the actor's membership inside the locked transaction (no stale roles). */
  async function loadActor(tx, householdId, userId) {
    const actor = await tx.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
      include: { user: true },
    });
    if (!actor) throw householdNotFound();
    if (!hasPermission(actor.role, PERMISSIONS.MEMBERS_INVITE)) throw notAllowed();
    return actor;
  }

  return {
    async create(householdId, actorUserId, { email, role }, client) {
      const now = new Date();
      const token = generateOpaqueToken();

      const { invitation, actor, household } = await prisma.$transaction(async (tx) => {
        await lockHousehold(tx, householdId);
        const actorMember = await loadActor(tx, householdId, actorUserId);

        if (!canAssignRole(actorMember.role, role)) throw notAllowed();
        if (email === actorMember.user.email) {
          throw badRequest('CANNOT_INVITE_SELF', 'You are already a member of this household');
        }
        const alreadyMember = await tx.householdMember.findFirst({
          where: { householdId, user: { email } },
          select: { id: true },
        });
        if (alreadyMember) {
          throw conflict('ALREADY_MEMBER', 'This person is already a member of the household');
        }

        const pendingForEmail = await tx.invitation.findFirst({
          where: { householdId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
        });
        if (pendingForEmail) {
          const ageSeconds = (now.getTime() - pendingForEmail.createdAt.getTime()) / 1000;
          if (ageSeconds < config.emailCooldownSeconds) {
            throw tooManyRequests(
              'INVITATION_RECENTLY_SENT',
              'An invitation was just sent to this address',
              Math.ceil(config.emailCooldownSeconds - ageSeconds),
            );
          }
        } else {
          const [members, pending] = await Promise.all([
            tx.householdMember.count({ where: { householdId } }),
            tx.invitation.count({
              where: { householdId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
            }),
          ]);
          if (members + pending >= config.maxHouseholdMembers) {
            throw conflict('HOUSEHOLD_FULL', 'This household has reached its member limit');
          }
        }

        // Re-inviting replaces the previous link: only the newest one works.
        await tx.invitation.updateMany({
          where: { householdId, email, acceptedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        const created = await tx.invitation.create({
          data: {
            householdId,
            email,
            role,
            tokenHash: hashToken(token),
            expiresAt: new Date(now.getTime() + config.invitationTtlSeconds * 1000),
            createdById: actorUserId,
          },
          include: { ...withInviter, household: true },
        });
        await audit.record(
          {
            action: AUDIT_ACTIONS.INVITATION_SENT,
            userId: actorUserId,
            householdId,
            entityType: 'Invitation',
            entityId: created.id,
            metadata: { email, role, resent: Boolean(pendingForEmail) },
            ipAddress: client.ipAddress,
          },
          tx,
        );
        return { invitation: created, actor: actorMember, household: created.household };
      });

      // Existing users get the email in their own language and by name; others in the inviter's.
      const recipient = await prisma.user.findUnique({ where: { email } });
      mail.sendInvitationEmail({
        to: email,
        language: recipient?.preferredLanguage ?? actor.user.preferredLanguage,
        name: recipient?.fullName,
        inviterName: actor.user.fullName,
        householdName: household.name,
        role,
        token,
      });

      return toPublicInvitation(invitation);
    },

    /** Outstanding invitations (pending or expired; accepted/revoked ones are history). */
    async list(householdId) {
      const invitations = await prisma.invitation.findMany({
        where: { householdId, acceptedAt: null, revokedAt: null },
        include: withInviter,
        orderBy: { createdAt: 'desc' },
      });
      return invitations.map(toPublicInvitation);
    },

    async revoke(householdId, actorUserId, invitationId, client) {
      await prisma.$transaction(async (tx) => {
        await lockHousehold(tx, householdId);
        const actor = await loadActor(tx, householdId, actorUserId);
        if (!UUID.test(invitationId)) throw invitationNotFound();
        const invitation = await tx.invitation.findFirst({
          where: { id: invitationId, householdId },
        });
        if (!invitation) throw invitationNotFound();
        if (invitation.acceptedAt || invitation.revokedAt) {
          throw conflict('INVITATION_NOT_PENDING', 'This invitation was already used or cancelled');
        }
        if (!canAssignRole(actor.role, invitation.role)) throw notAllowed();

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { revokedAt: new Date() },
        });
        await audit.record(
          {
            action: AUDIT_ACTIONS.INVITATION_REVOKED,
            userId: actorUserId,
            householdId,
            entityType: 'Invitation',
            entityId: invitation.id,
            metadata: { email: invitation.email },
            ipAddress: client.ipAddress,
          },
          tx,
        );
      });
    },

    /** What the invite link page shows, before the invitee signs in or even has an account. */
    async preview(token) {
      const invitation = await prisma.invitation.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { ...withInviter, household: { select: { name: true } } },
      });
      if (!invitation || !isPending(invitation)) throw invalidInvitation();
      return {
        householdName: invitation.household.name,
        invitedBy: invitation.createdBy?.fullName ?? null,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      };
    },

    /**
     * Joins the household. The signed-in account must own the invited address (sign-in requires
     * a verified email, so this proves inbox ownership): a forwarded link is useless to others.
     */
    async accept(token, user, client) {
      const found = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!found || !isPending(found)) throw invalidInvitation();
      if (found.email !== user.email) {
        throw forbidden(
          'INVITATION_EMAIL_MISMATCH',
          'This invitation was sent to a different email address',
        );
      }

      return prisma.$transaction(async (tx) => {
        await lockHousehold(tx, found.householdId);
        const existing = await tx.householdMember.findUnique({
          where: { householdId_userId: { householdId: found.householdId, userId: user.id } },
        });
        if (existing) {
          throw conflict('ALREADY_MEMBER', 'You are already a member of this household');
        }
        const now = new Date();
        // Compare-and-swap: only one request can consume the invitation.
        const { count } = await tx.invitation.updateMany({
          where: { id: found.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (count !== 1) throw invalidInvitation();

        await tx.householdMember.create({
          data: { householdId: found.householdId, userId: user.id, role: found.role },
        });
        await audit.record(
          {
            action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
            userId: user.id,
            householdId: found.householdId,
            entityType: 'Invitation',
            entityId: found.id,
            metadata: { role: found.role },
            ipAddress: client.ipAddress,
          },
          tx,
        );
        const household = await tx.household.findUniqueOrThrow({
          where: { id: found.householdId },
          include: { _count: { select: { members: true } } },
        });
        return toPublicHousehold(household, found.role, household._count.members);
      });
    },
  };
}
