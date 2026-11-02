export function createHealthController({ healthService }) {
  return {
    async getHealth(req, res) {
      const { database } = await healthService.check();
      const healthy = database === 'up';
      res
        .status(healthy ? 200 : 503)
        .set('Cache-Control', 'no-store')
        .json({ data: { status: healthy ? 'ok' : 'degraded', database } });
    },
  };
}
