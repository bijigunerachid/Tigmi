import { SignJWT } from 'jose';
import {
  createAccessTokenSigner,
  generateOpaqueToken,
  hashToken,
  safeEqual,
} from '../../src/modules/auth/tokens.js';

const secret = 'unit-test-secret-'.padEnd(64, 'x');
const signer = createAccessTokenSigner({ secret, ttlSeconds: 900 });

describe('opaque tokens', () => {
  it('are 256-bit, URL-safe and unique', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateOpaqueToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('hash to a stable 64-char hex SHA-256', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('safeEqual compares strings without throwing on length or type mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(undefined, 'abc')).toBe(false);
  });
});

describe('access tokens', () => {
  it('round-trip user and session ids and expire after the TTL', async () => {
    const { token, expiresAt } = await signer.sign({ userId: 'user-1', sessionId: 'session-1' });
    expect(await signer.verify(token)).toEqual({ userId: 'user-1', sessionId: 'session-1' });
    const ttl = (expiresAt.getTime() - Date.now()) / 1000;
    expect(ttl).toBeGreaterThan(890);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('rejects a token signed with another secret', async () => {
    const other = createAccessTokenSigner({
      secret: 'another-secret-'.padEnd(64, 'y'),
      ttlSeconds: 900,
    });
    const { token } = await other.sign({ userId: 'u', sessionId: 's' });
    expect(await signer.verify(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = createAccessTokenSigner({ secret, ttlSeconds: -10 });
    const { token } = await expired.sign({ userId: 'u', sessionId: 's' });
    expect(await signer.verify(token)).toBeNull();
  });

  it('rejects the "none" algorithm and tokens for another audience', async () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'u', sid: 's', iss: 'tigmi-api', aud: 'tigmi', exp: 9999999999 }),
    ).toString('base64url');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(await signer.verify(`${header}.${payload}.`)).toBeNull();

    const wrongAudience = await new SignJWT({ sid: 's' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('tigmi-api')
      .setAudience('someone-else')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    expect(await signer.verify(wrongAudience)).toBeNull();
  });

  it('rejects a token missing the session id', async () => {
    const noSid = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('tigmi-api')
      .setAudience('tigmi')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    expect(await signer.verify(noSid)).toBeNull();
  });
});
