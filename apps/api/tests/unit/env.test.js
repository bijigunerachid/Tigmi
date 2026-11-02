import { loadEnv } from '../../src/config/env.js';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://tigmi:secret123@localhost:5432/tigmi',
  CORS_ORIGINS: 'http://localhost:5180, http://localhost:5181',
};

describe('loadEnv', () => {
  it('parses a valid configuration and applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
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
    };

    it('accepts https origins and a real password', () => {
      expect(() => loadEnv(production)).not.toThrow();
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
