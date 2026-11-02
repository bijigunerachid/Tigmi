import pino from 'pino';

// Anything that could carry a credential is replaced before it reaches the logs.
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

export function createLogger({ level, pretty = false }) {
  return pino({
    level,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    ...(pretty && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  });
}
