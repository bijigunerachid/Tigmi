import { loginSchema, refreshBodySchema, registerSchema } from '@tigmi/validation';
import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { validateBody } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { createAuthCookies } from './cookies.js';

export function createAuthRouter({ prisma, env, config, accessTokens, audit, authenticate }) {
  const authCookies = createAuthCookies({ cookieNames: config.cookies, secure: env.COOKIE_SECURE });
  const authService = createAuthService({ prisma, accessTokens, audit, config });
  const controller = createAuthController({
    authService,
    authCookies,
    cookieNames: config.cookies,
  });

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

  return router;
}
