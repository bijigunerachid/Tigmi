const clientInfo = (req) => ({ ipAddress: req.ip });

export function createHouseholdsController({ householdsService, membersService }) {
  return {
    async create(req, res) {
      const household = await householdsService.create(req.auth.userId, req.body, clientInfo(req));
      res.status(201).json({ data: { household } });
    },

    async list(req, res) {
      const households = await householdsService.listForUser(req.auth.userId);
      res.json({ data: { households } });
    },

    async get(req, res) {
      const household = await householdsService.get(req.household.id, req.household.role);
      res.json({ data: { household } });
    },

    async update(req, res) {
      const actor = { userId: req.auth.userId, role: req.household.role };
      const household = await householdsService.update(
        req.household.id,
        actor,
        req.body,
        clientInfo(req),
      );
      res.json({ data: { household } });
    },

    async remove(req, res) {
      const actor = { userId: req.auth.userId, role: req.household.role };
      await householdsService.remove(
        req.household.id,
        actor,
        req.body.confirmName,
        clientInfo(req),
      );
      res.status(204).end();
    },

    async listMembers(req, res) {
      const members = await membersService.list(req.household.id);
      res.json({ data: { members } });
    },

    async changeMemberRole(req, res) {
      const member = await membersService.changeRole(
        req.household.id,
        req.auth.userId,
        req.params.memberId,
        req.body.role,
        clientInfo(req),
      );
      res.json({ data: { member } });
    },

    async removeMember(req, res) {
      await membersService.remove(
        req.household.id,
        req.auth.userId,
        req.params.memberId,
        clientInfo(req),
      );
      res.status(204).end();
    },
  };
}
