import { AppError, notFound } from '../utils/errors.js';

/** Turns any unmatched route into a 404 JSON error. */
export function notFoundHandler(req, res, next) {
  next(notFound(`Route ${req.method} ${req.path} not found`));
}

/**
 * Single place that converts errors into the API error format:
 *   { "error": { "code", "message", "details"?, "requestId" } }
 * Unexpected errors are logged in full but reported to the client without internals.
 */
// Express recognises error handlers by their four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  } else if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (!(error instanceof AppError)) {
    req.log.error({ err }, 'Unhandled error');
    error = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
      requestId: req.id,
    },
  });
}
