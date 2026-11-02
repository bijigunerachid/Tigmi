import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// URL');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: postgresUrl,
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (/changeme/i.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'uses the example password; set a real secret in production',
      });
    }
    if (env.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'must only contain https:// origins in production',
      });
    }
  });

/**
 * Validates environment variables once at startup.
 * Throws an error listing every invalid variable (names only — values may be secrets).
 */
export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(result.data);
}
