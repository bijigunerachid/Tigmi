import { toPublicUser } from '../users/users.serializer.js';
import { forbidden, unauthorized } from '../../utils/errors.js';
import { generateOpaqueToken, safeEqual } from './tokens.js';

/** Mobile apps send this header and receive the refresh token in the body (stored in SecureStore). */
const isMobileClient = (req) => req.get('x-client-type') === 'mobile';

const clientInfo = (req) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') });

/** Same body for every "we may have sent you an email" answer, so responses reveal nothing. */
const CHECK_EMAIL = Object.freeze({ data: { status: 'check_email' } });

export function createAuthController({ authService, authCookies, cookieNames }) {
  /**
   * Web: refresh token goes into the HttpOnly cookie and never appears in the body.
   * Mobile: refresh token is returned in the body; no cookies.
   */
  function sendAuthResult(req, res, status, result, { mobile, csrfToken }) {
    const data = {
      user: result.user,
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
    };

    if (mobile) {
      data.refreshToken = result.refreshToken;
      data.sessionExpiresAt = result.sessionExpiresAt.toISOString();
    } else {
      const csrf = csrfToken ?? generateOpaqueToken();
      authCookies.set(res, {
        refreshToken: result.refreshToken,
        csrfToken: csrf,
        expiresAt: result.sessionExpiresAt,
      });
      data.csrfToken = csrf;
    }

    res.status(status).json({ data });
  }

  return {
    async register(req, res) {
      await authService.register(req.body, clientInfo(req));
      // Identical answer whether the email was new or already registered.
      res.status(202).json(CHECK_EMAIL);
    },

    async verifyEmail(req, res) {
      await authService.verifyEmail(req.body.token, clientInfo(req));
      res.status(204).end();
    },

    async resendVerification(req, res) {
      await authService.resendVerification(req.body.email);
      res.status(202).json(CHECK_EMAIL);
    },

    async forgotPassword(req, res) {
      await authService.forgotPassword(req.body.email, clientInfo(req));
      res.status(202).json(CHECK_EMAIL);
    },

    async resetPassword(req, res) {
      await authService.resetPassword(req.body, clientInfo(req));
      authCookies.clear(res); // every session was revoked
      res.status(204).end();
    },

    async login(req, res) {
      const result = await authService.login(req.body, clientInfo(req));
      sendAuthResult(req, res, 200, result, { mobile: isMobileClient(req) });
    },

    async refresh(req, res) {
      const bodyToken = req.body?.refreshToken;
      if (bodyToken) {
        const result = await authService.refresh(bodyToken, clientInfo(req));
        return sendAuthResult(req, res, 200, result, { mobile: true });
      }

      const cookieToken = req.cookies?.[cookieNames.refreshToken];
      if (!cookieToken) throw unauthorized('INVALID_REFRESH_TOKEN', 'No refresh token provided');

      // Cookie-based request: require the double-submit CSRF header.
      const csrfCookie = req.cookies?.[cookieNames.csrfToken];
      if (!csrfCookie || !safeEqual(req.get('x-csrf-token'), csrfCookie)) {
        throw forbidden('CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
      }

      try {
        const result = await authService.refresh(cookieToken, clientInfo(req));
        sendAuthResult(req, res, 200, result, { mobile: false, csrfToken: csrfCookie });
      } catch (error) {
        // A dead token is useless: remove it so the browser stops sending it.
        if (error.code === 'INVALID_REFRESH_TOKEN') authCookies.clear(res);
        throw error;
      }
    },

    async logout(req, res) {
      await authService.logout(req.auth, clientInfo(req));
      authCookies.clear(res);
      res.status(204).end();
    },

    me(req, res) {
      res.json({ data: { user: toPublicUser(req.auth.user) } });
    },
  };
}
