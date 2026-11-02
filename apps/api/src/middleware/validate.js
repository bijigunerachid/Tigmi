import { badRequest } from '../utils/errors.js';

// Shared schemas use snake_case codes as messages (e.g. "password_too_short") for translation.
const MESSAGE_CODE = /^[a-z_]+$/;

/**
 * Validates req.body with a Zod schema and replaces it with the parsed (trimmed,
 * normalised, unknown-keys-rejected) value. Responds 400 VALIDATION_ERROR with per-field codes.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || null,
        code: MESSAGE_CODE.test(issue.message) ? issue.message : issue.code,
        ...(issue.code === 'unrecognized_keys' && { keys: issue.keys }),
      }));
      return next(badRequest('VALIDATION_ERROR', 'Request validation failed', details));
    }
    req.body = result.data;
    next();
  };
}
