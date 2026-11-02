import argon2 from 'argon2';

/** OWASP Password Storage Cheat Sheet: Argon2id, m=19 MiB, t=2, p=1. */
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed hash must never crash login or count as a match.
    return false;
  }
}

/** True when the stored hash used older/weaker parameters and should be re-hashed. */
export const needsRehash = (hash) => argon2.needsRehash(hash, ARGON2_OPTIONS);

/**
 * Login with an unknown email still runs one Argon2 verification against this hash,
 * so response time does not reveal whether an account exists.
 */
let dummyHashPromise;
export function getDummyHash() {
  dummyHashPromise ??= hashPassword('tigmi-timing-equaliser-not-a-real-password');
  return dummyHashPromise;
}
