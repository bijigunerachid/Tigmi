import { unauthorized } from '../utils/errors.js';

/**
 * Requires a valid "Authorization: Bearer <access token>" header.
 * Besides checking the JWT signature, it loads the session from the database on every request,
 * so logout, "sign out this device" and theft detection take effect immediately — not when the
 * 15-minute access token expires.
 *
 * Sets req.auth = { userId, sessionId, user }.
 */
export function createAuthenticate({ prisma, accessTokens }) {
  return async function authenticate(req, res, next) {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());

    const claims = await accessTokens.verify(token);
    if (!claims)
      return next(unauthorized('INVALID_ACCESS_TOKEN', 'Access token is invalid or expired'));

    const session = await prisma.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: true },
    });
    const sessionIsActive =
      session &&
      session.userId === claims.userId &&
      session.revokedAt === null &&
      session.expiresAt > new Date();
    if (!sessionIsActive)
      return next(unauthorized('SESSION_REVOKED', 'Session is no longer active'));

    req.auth = { userId: session.userId, sessionId: session.id, user: session.user };
    next();
  };
}
