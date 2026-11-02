import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS } from '../audit/audit.service.js';
import { toPublicUser } from '../users/users.serializer.js';
import {
  badRequest,
  conflict,
  forbidden,
  tooManyRequests,
  unauthorized,
} from '../../utils/errors.js';
import { getDummyHash, hashPassword, needsRehash, verifyPassword } from './password.js';
import { generateOpaqueToken, hashToken } from './tokens.js';

const invalidCredentials = () =>
  unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
const invalidRefreshToken = () =>
  unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
const invalidEmailToken = () =>
  badRequest('INVALID_OR_EXPIRED_TOKEN', 'This link is invalid, expired or already used');

const EMAIL_VERIFICATION = 'EMAIL_VERIFICATION';
const PASSWORD_RESET = 'PASSWORD_RESET';

/**
 * Authentication use cases. Controllers handle HTTP (cookies, status codes);
 * this service handles rules and data. `client` = { ipAddress, userAgent }.
 */
export function createAuthService({ prisma, accessTokens, audit, config, mail, userTokens }) {
  /** Creates a session (one per device) with its first refresh token, then signs an access token. */
  async function startSession(db, user, client) {
    const refreshToken = generateOpaqueToken();
    const session = await db.session.create({
      data: {
        userId: user.id,
        userAgent: client.userAgent?.slice(0, 512) ?? null,
        ipAddress: client.ipAddress ?? null,
        expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000),
        refreshTokens: { create: { tokenHash: hashToken(refreshToken) } },
      },
    });
    return buildAuthResult(user, session, refreshToken);
  }

  async function buildAuthResult(user, session, refreshToken) {
    const access = await accessTokens.sign({ userId: user.id, sessionId: session.id });
    return {
      user: toPublicUser(user),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      sessionExpiresAt: session.expiresAt,
    };
  }

  return {
    /**
     * Same outcome for new and existing emails (no account enumeration): nothing is returned,
     * and the email inbox receives either a verification link or an "account exists" notice.
     * The password is hashed in both cases so timing does not differ either.
     */
    async register({ fullName, email, password, preferredLanguage }, client) {
      const passwordHash = await hashPassword(password);
      try {
        const { user, token } = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: { fullName, email, passwordHash, preferredLanguage },
          });
          const verificationToken = await userTokens.issue(tx, {
            userId: created.id,
            purpose: EMAIL_VERIFICATION,
            ttlSeconds: config.emailVerificationTtlSeconds,
          });
          await audit.record(
            { action: AUDIT_ACTIONS.REGISTER, userId: created.id, ipAddress: client.ipAddress },
            tx,
          );
          return { user: created, token: verificationToken };
        });
        mail.sendVerificationEmail(user, token);
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          mail.sendAccountExistsEmail(existing);
          await audit.record({
            action: AUDIT_ACTIONS.REGISTER_EXISTING_EMAIL,
            userId: existing.id,
            ipAddress: client.ipAddress,
          });
        }
      }
    },

    async verifyEmail(token, client) {
      const row = await userTokens.findValid(token, EMAIL_VERIFICATION);
      if (!row) throw invalidEmailToken();

      await prisma.$transaction(async (tx) => {
        if (!(await userTokens.consume(tx, row.id))) throw invalidEmailToken();
        await tx.user.update({
          where: { id: row.userId },
          data: { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
        });
        await audit.record(
          { action: AUDIT_ACTIONS.EMAIL_VERIFIED, userId: row.userId, ipAddress: client.ipAddress },
          tx,
        );
      });
    },

    /** Always succeeds from the caller's point of view; only unverified accounts get an email. */
    async resendVerification(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.emailVerifiedAt) return;
      const tooSoon = await userTokens.issuedWithin({
        userId: user.id,
        purpose: EMAIL_VERIFICATION,
        seconds: config.emailCooldownSeconds,
      });
      if (tooSoon) return;
      const token = await userTokens.issue(prisma, {
        userId: user.id,
        purpose: EMAIL_VERIFICATION,
        ttlSeconds: config.emailVerificationTtlSeconds,
      });
      mail.sendVerificationEmail(user, token);
    },

    /** Always succeeds from the caller's point of view; only existing accounts get an email. */
    async forgotPassword(email, client) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return;
      const tooSoon = await userTokens.issuedWithin({
        userId: user.id,
        purpose: PASSWORD_RESET,
        seconds: config.emailCooldownSeconds,
      });
      if (tooSoon) return;
      const token = await userTokens.issue(prisma, {
        userId: user.id,
        purpose: PASSWORD_RESET,
        ttlSeconds: config.passwordResetTtlSeconds,
      });
      await audit.record({
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        userId: user.id,
        ipAddress: client.ipAddress,
      });
      mail.sendPasswordResetEmail(user, token);
    },

    /**
     * Sets a new password from an emailed link. Proves inbox ownership, so it also verifies the
     * email and lifts any lockout. Every session is revoked: whoever knew the old password
     * (or held a stolen token) is signed out everywhere.
     */
    async resetPassword({ token, password }, client) {
      const row = await userTokens.findValid(token, PASSWORD_RESET);
      if (!row) throw invalidEmailToken();
      // Checked before consuming, so a rejected password does not burn the link.
      if (password.toLowerCase() === row.user.email) {
        throw badRequest('VALIDATION_ERROR', 'Request validation failed', [
          { field: 'password', code: 'password_equals_email' },
        ]);
      }
      const passwordHash = await hashPassword(password);
      const now = new Date();

      const user = await prisma.$transaction(async (tx) => {
        if (!(await userTokens.consume(tx, row.id))) throw invalidEmailToken();
        await tx.userToken.deleteMany({
          where: { userId: row.userId, purpose: PASSWORD_RESET, usedAt: null },
        });
        await tx.session.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'password_reset' },
        });
        await audit.record(
          { action: AUDIT_ACTIONS.PASSWORD_RESET, userId: row.userId, ipAddress: client.ipAddress },
          tx,
        );
        return tx.user.update({
          where: { id: row.userId },
          data: {
            passwordHash,
            emailVerifiedAt: row.user.emailVerifiedAt ?? now,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
      });
      mail.sendPasswordChangedEmail(user);
    },

    async login({ email, password }, client) {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        await verifyPassword(await getDummyHash(), password); // equalise timing
        await audit.record({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          metadata: { reason: 'unknown_email' },
          ipAddress: client.ipAddress,
        });
        throw invalidCredentials();
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
        throw tooManyRequests(
          'ACCOUNT_LOCKED',
          'Too many failed attempts. Try again later.',
          retryAfter,
        );
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
        // Atomic increment: concurrent wrong guesses cannot "lose" a failure.
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
        });
        await audit.record({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: 'wrong_password', failedCount: updated.failedLoginCount },
          ipAddress: client.ipAddress,
        });
        if (updated.failedLoginCount >= config.maxFailedLogins) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: 0,
              lockedUntil: new Date(Date.now() + config.lockoutSeconds * 1000),
            },
          });
          await audit.record({
            action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
            userId: user.id,
            metadata: { lockoutSeconds: config.lockoutSeconds },
            ipAddress: client.ipAddress,
          });
        }
        throw invalidCredentials();
      }

      // Only revealed after a correct password, so it does not help an attacker guess accounts.
      if (!user.emailVerifiedAt) {
        if (user.failedLoginCount > 0) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0 } });
        }
        throw forbidden(
          'EMAIL_NOT_VERIFIED',
          'Please confirm your email address before signing in',
        );
      }

      const passwordHash = needsRehash(user.passwordHash)
        ? await hashPassword(password)
        : undefined;

      return prisma.$transaction(async (tx) => {
        const fresh = await tx.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, ...(passwordHash && { passwordHash }) },
        });
        await audit.record(
          { action: AUDIT_ACTIONS.LOGIN, userId: user.id, ipAddress: client.ipAddress },
          tx,
        );
        return startSession(tx, fresh, client);
      });
    },

    /**
     * Rotation: every refresh token works exactly once and is replaced by a new one.
     * Presenting an already-used token (outside the short multi-tab grace window) means a copy
     * exists somewhere else → the whole session is revoked, signing out attacker and victim.
     */
    async refresh(refreshToken, client) {
      const now = new Date();
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        include: { session: { include: { user: true } } },
      });
      if (!stored) throw invalidRefreshToken();

      const { session } = stored;
      if (session.revokedAt || session.expiresAt <= now) throw invalidRefreshToken();

      if (stored.usedAt) {
        const ageSeconds = (now.getTime() - stored.usedAt.getTime()) / 1000;
        if (ageSeconds <= config.refreshReuseGraceSeconds) {
          throw conflict('REFRESH_IN_PROGRESS', 'Session was just refreshed; retry the request');
        }
        await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: now, revokedReason: 'refresh_token_reuse' },
        });
        await audit.record({
          action: AUDIT_ACTIONS.REFRESH_TOKEN_REUSE,
          userId: session.userId,
          entityType: 'Session',
          entityId: session.id,
          ipAddress: client.ipAddress,
        });
        throw invalidRefreshToken();
      }

      const newRefreshToken = generateOpaqueToken();
      await prisma.$transaction(async (tx) => {
        // Conditional update = compare-and-swap: only one concurrent request can win.
        const { count } = await tx.refreshToken.updateMany({
          where: { id: stored.id, usedAt: null },
          data: { usedAt: now },
        });
        if (count !== 1) {
          throw conflict('REFRESH_IN_PROGRESS', 'Session was just refreshed; retry the request');
        }
        await tx.refreshToken.create({
          data: { sessionId: session.id, tokenHash: hashToken(newRefreshToken) },
        });
        await tx.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
      });

      return buildAuthResult(session.user, session, newRefreshToken);
    },

    async logout({ userId, sessionId }, client) {
      await prisma.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'logout' },
      });
      await audit.record({
        action: AUDIT_ACTIONS.LOGOUT,
        userId,
        entityType: 'Session',
        entityId: sessionId,
        ipAddress: client.ipAddress,
      });
    },
  };
}
