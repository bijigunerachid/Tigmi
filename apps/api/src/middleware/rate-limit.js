import { rateLimit } from 'express-rate-limit';
import { tooManyRequests } from '../utils/errors.js';

/**
 * Per-IP rate limiter that answers in the standard API error format.
 * In-memory store: fine for a single API instance. Running several instances requires a shared
 * store (PostgreSQL/Redis) — tracked in docs/security.md.
 */
export function createRateLimiter({ windowSeconds, limit }) {
  return rateLimit({
    windowMs: windowSeconds * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res, next, options) {
      next(
        tooManyRequests(
          'RATE_LIMITED',
          'Too many requests, please try again later',
          Math.ceil(options.windowMs / 1000),
        ),
      );
    },
  });
}
