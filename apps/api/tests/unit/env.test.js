import { loadEnv } from '../../src/config/env.js';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://tigmi:secret123@localhost:5432/tigmi',
  CORS_ORIGINS: 'http://localhost:5180, http://localhost:5181',
  JWT_ACCESS_SECRET: 'a'.repeat(43),
  APP_URL: 'http://localhost:5180/',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Tigmi <no-reply@tigmi.local>',
};

describe('loadEnv', () => {
  it('parses a valid configuration and applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.APP_URL).toBe('http://localhost:5180'); // trailing slash removed
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5180', 'http://localhost:5181']);
  });

  it('returns a frozen object so config cannot be changed at runtime', () => {
    expect(Object.isFrozen(loadEnv(valid))).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(
      /DATABASE_URL: must be a postgresql:\/\/ URL/,
    );
  });

  it('rejects a JWT secret shorter than 32 bytes', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('parses COOKIE_SECURE as a boolean and rejects other values', () => {
    expect(loadEnv({ ...valid, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(() => loadEnv({ ...valid, COOKIE_SECURE: 'yes' })).toThrow(/COOKIE_SECURE/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...valid, API_PORT: '99999' })).toThrow(/API_PORT/);
  });

  it('never includes variable values in the error message', () => {
    const secret = 'super-secret-value';
    expect(() => loadEnv({ ...valid, DATABASE_URL: `not-a-url-${secret}` })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });

  describe('in production', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.tigmi.example',
      APP_URL: 'https://app.tigmi.example',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'smtp-secret',
    };

    it('accepts https origins and a real password, and defaults COOKIE_SECURE to true', () => {
      expect(loadEnv(production).COOKIE_SECURE).toBe(true);
    });

    it('requires an https APP_URL and SMTP credentials', () => {
      expect(() => loadEnv({ ...production, APP_URL: 'http://app.tigmi.example' })).toThrow(
        /APP_URL: must be https/,
      );
      expect(() => loadEnv({ ...production, SMTP_PASSWORD: '' })).toThrow(
        /SMTP credentials are required/,
      );
    });

    it('refuses insecure cookies', () => {
      expect(() => loadEnv({ ...production, COOKIE_SECURE: 'false' })).toThrow(
        /COOKIE_SECURE: must be true in production/,
      );
    });

    it('rejects the example JWT secret', () => {
      expect(() =>
        loadEnv({
          ...production,
          JWT_ACCESS_SECRET: 'changeme-generate-a-real-secret-with-the-command-above',
        }),
      ).toThrow(/JWT_ACCESS_SECRET: uses the example value/);
    });

    it('rejects the example password', () => {
      expect(() =>
        loadEnv({ ...production, DATABASE_URL: 'postgresql://tigmi:changeme@db:5432/tigmi' }),
      ).toThrow(/DATABASE_URL: uses the example password/);
    });

    it('rejects plain http origins', () => {
      expect(() => loadEnv({ ...production, CORS_ORIGINS: 'http://app.tigmi.example' })).toThrow(
        /CORS_ORIGINS: must only contain https/,
      );
    });
  });
});
