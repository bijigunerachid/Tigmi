import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';

const ISSUER = 'tigmi-api';
const AUDIENCE = 'tigmi';
const ALGORITHM = 'HS256';

/** 256-bit random value, URL-safe. Used for refresh and CSRF tokens. */
export const generateOpaqueToken = () => randomBytes(32).toString('base64url');

/**
 * Refresh tokens are long random values, so a fast SHA-256 is enough to protect them at rest
 * (unlike passwords, they cannot be guessed from a dictionary).
 */
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function createAccessTokenSigner({ secret, ttlSeconds }) {
  const key = new TextEncoder().encode(secret);

  return {
    async sign({ userId, sessionId }) {
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + ttlSeconds;
      const token = await new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(key);
      return { token, expiresAt: new Date(expiresAt * 1000) };
    },

    /** Returns { userId, sessionId } or null for any invalid, expired or tampered token. */
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: ISSUER,
          audience: AUDIENCE,
          algorithms: [ALGORITHM],
        });
        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
        return { userId: payload.sub, sessionId: payload.sid };
      } catch (error) {
        if (error instanceof joseErrors.JOSEError) return null;
        throw error;
      }
    },
  };
}
