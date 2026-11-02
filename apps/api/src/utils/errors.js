/**
 * An error that is safe to show to the client.
 * `code` is a stable machine-readable identifier that the web and mobile apps translate.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);

export const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
