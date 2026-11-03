const clientInfo = (req) => ({ ipAddress: req.ip });

export function createInvitationsController({ invitationsService }) {
  return {
    async create(req, res) {
      const invitation = await invitationsService.create(
        req.household.id,
        req.auth.userId,
        req.body,
        clientInfo(req),
      );
      res.status(201).json({ data: { invitation } });
    },

    async list(req, res) {
      const invitations = await invitationsService.list(req.household.id);
      res.json({ data: { invitations } });
    },

    async revoke(req, res) {
      await invitationsService.revoke(
        req.household.id,
        req.auth.userId,
        req.params.invitationId,
        clientInfo(req),
      );
      res.status(204).end();
    },

    async preview(req, res) {
      const invitation = await invitationsService.preview(req.body.token);
      res.set('Cache-Control', 'no-store').json({ data: { invitation } });
    },

    async accept(req, res) {
      const household = await invitationsService.accept(
        req.body.token,
        req.auth.user,
        clientInfo(req),
      );
      res.json({ data: { household } });
    },
  };
}
