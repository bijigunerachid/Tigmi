/**
 * An error that is safe to show to the client.
 * `code` is a stable machine-readable identifier that the web and mobile apps translate.
 */
export class AppError extends Error {
  constructor(status, code, message, { details, headers } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, { details });

export const unauthorized = (code = 'UNAUTHENTICATED', message = 'Authentication required') =>
  new AppError(401, code, message, { headers: { 'WWW-Authenticate': 'Bearer' } });

export const forbidden = (code = 'FORBIDDEN', message = 'You are not allowed to do this') =>
  new AppError(403, code, message);

export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (code, message) => new AppError(409, code, message);

export const tooManyRequests = (code, message, retryAfterSeconds) =>
  new AppError(429, code, message, {
    headers: retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined,
  });

export const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
