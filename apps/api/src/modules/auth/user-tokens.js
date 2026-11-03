import { generateOpaqueToken, hashToken } from './tokens.js';

/**
 * Single-use tokens sent by email. Issuing a new token deletes the user's previous unused
 * tokens for the same purpose, so only the latest link works.
 */
export function createUserTokens({ prisma }) {
  /** A fresh token and the row to store (hash only), for use in a nested create. */
  function prepare({ purpose, ttlSeconds }) {
    const token = generateOpaqueToken();
    return {
      token,
      data: {
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    };
  }

  return {
    prepare,

    async issue(db, { userId, purpose, ttlSeconds }) {
      const { token, data } = prepare({ purpose, ttlSeconds });
      await db.userToken.deleteMany({ where: { userId, purpose, usedAt: null } });
      await db.userToken.create({ data: { userId, ...data } });
      return token;
    },

    /** True when a token of this purpose was issued less than `seconds` ago. */
    async issuedWithin({ userId, purpose, seconds }) {
      const recent = await prisma.userToken.findFirst({
        where: { userId, purpose, createdAt: { gt: new Date(Date.now() - seconds * 1000) } },
        select: { id: true },
      });
      return recent !== null;
    },

    /** Returns the valid (unused, unexpired) token row with its user, or null. Does not consume. */
    findValid(token, purpose) {
      return prisma.userToken.findFirst({
        where: {
          tokenHash: hashToken(token),
          purpose,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
    },

    /** Marks the token used. Compare-and-swap: false if another request consumed it first. */
    async consume(db, id) {
      const { count } = await db.userToken.updateMany({
        where: { id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      return count === 1;
    },
  };
}
