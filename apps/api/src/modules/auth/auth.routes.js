import {
  emailRequestSchema,
  loginSchema,
  refreshBodySchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@tigmi/validation';
import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { validateBody } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { createAuthCookies } from './cookies.js';
import { createUserTokens } from './user-tokens.js';

export function createAuthRouter({ prisma, env, config, accessTokens, audit, authenticate, mail }) {
  const authCookies = createAuthCookies({ cookieNames: config.cookies, secure: env.COOKIE_SECURE });
  const authService = createAuthService({
    prisma,
    accessTokens,
    audit,
    config,
    mail,
    userTokens: createUserTokens({ prisma }),
  });
  const controller = createAuthController({
    authService,
    authCookies,
    cookieNames: config.cookies,
  });

  // Shared limiters: "send me an email" endpoints and "submit an emailed token" endpoints.
  const emailRequestLimiter = createRateLimiter(config.rateLimits.emailRequest);
  const tokenSubmitLimiter = createRateLimiter(config.rateLimits.tokenSubmit);

  const router = Router();

  // Auth responses carry tokens: never cache them anywhere.
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post(
    '/register',
    createRateLimiter(config.rateLimits.register),
    validateBody(registerSchema),
    controller.register,
  );
  router.post(
    '/login',
    createRateLimiter(config.rateLimits.login),
    validateBody(loginSchema),
    controller.login,
  );
  router.post(
    '/refresh',
    createRateLimiter(config.rateLimits.refresh),
    validateBody(refreshBodySchema),
    controller.refresh,
  );
  router.post('/logout', authenticate, controller.logout);
  router.get('/me', authenticate, controller.me);

  router.post(
    '/verify-email',
    tokenSubmitLimiter,
    validateBody(verifyEmailSchema),
    controller.verifyEmail,
  );
  router.post(
    '/resend-verification',
    emailRequestLimiter,
    validateBody(emailRequestSchema),
    controller.resendVerification,
  );
  router.post(
    '/forgot-password',
    emailRequestLimiter,
    validateBody(emailRequestSchema),
    controller.forgotPassword,
  );
  router.post(
    '/reset-password',
    tokenSubmitLimiter,
    validateBody(resetPasswordSchema),
    controller.resetPassword,
  );

  return router;
}
