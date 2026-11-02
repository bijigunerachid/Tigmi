import argon2 from 'argon2';
import { hashPassword, needsRehash, verifyPassword } from '../../src/modules/auth/password.js';

describe('password hashing', () => {
  it('uses Argon2id with OWASP parameters and a unique salt', async () => {
    const first = await hashPassword('a long family passphrase');
    const second = await hashPassword('a long family passphrase');
    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('كلمة سر طويلة جدا'); // Arabic passphrase
    expect(await verifyPassword(hash, 'كلمة سر طويلة جدا')).toBe(true);
    expect(await verifyPassword(hash, 'كلمة سر طويلة جدً')).toBe(false);
  });

  it('returns false (never throws) for a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('flags hashes made with weaker parameters for re-hashing', async () => {
    const weak = await argon2.hash('pw', { type: argon2.argon2id, memoryCost: 4096, timeCost: 1 });
    expect(needsRehash(weak)).toBe(true);
    expect(needsRehash(await hashPassword('pw'))).toBe(false);
  });
});
