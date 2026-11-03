import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Interactive transaction limits. Prisma's defaults (wait 2 s for a connection, 5 s per
 * transaction) proved too tight when the machine is busy (seen in end-to-end runs). These keep
 * headroom while still aborting runaway transactions. Keep transactions short regardless.
 */
export const TRANSACTION_OPTIONS = Object.freeze({ maxWait: 5_000, timeout: 10_000 });

/** Creates a Prisma client using the node-postgres driver adapter (required by Prisma 7). */
export function createPrismaClient(databaseUrl) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter, transactionOptions: TRANSACTION_OPTIONS });
}
