/**
 * Reports whether the API can reach its database.
 * Uses a trivial query with a short timeout so a hung database cannot hang the health check.
 */
export function createHealthService({ prisma, timeoutMs = 2000 }) {
  return {
    async check() {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database check timed out')), timeoutMs);
      });
      try {
        await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
        return { database: 'up' };
      } catch {
        return { database: 'down' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
