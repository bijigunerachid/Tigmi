import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../src/config/env.js';

const rootEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

/**
 * Returns the test database URL and refuses anything that is not a *_test database,
 * so a misconfigured machine can never wipe development or production data.
 */
export function getTestDatabaseUrl() {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${databaseName}": name must end with _test`);
  }
  return url;
}

/** A validated env object pointing at the test database. */
export function createTestEnv(overrides = {}) {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: getTestDatabaseUrl(),
    CORS_ORIGINS: 'http://localhost:5180',
    LOG_LEVEL: 'silent',
    // Test-only signing key: never used outside the test process.
    JWT_ACCESS_SECRET: 'test-only-secret-'.padEnd(64, 'x'),
    APP_URL: 'http://localhost:5180',
    SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
    SMTP_PORT: process.env.SMTP_PORT ?? '1025',
    MAIL_FROM: 'Tigmi <no-reply@tigmi.local>',
    ...overrides,
  });
}
