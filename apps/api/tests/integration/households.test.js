import request from 'supertest';
import { createSignedInUser, createTestContext, resetDatabase } from '../helpers/test-app.js';

const ctx = createTestContext();
const { app, prisma } = ctx;

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const api = (method, path, auth) => {
  const req = request(app)[method](`/api/v1${path}`);
  return auth ? req.set('Authorization', auth) : req;
};

/** Owner + household, plus optional extra members with given roles (added directly in DB). */
async function setupHousehold(extraRoles = []) {
  const owner = await createSignedInUser(ctx, { fullName: 'Owner' });
  const res = await api('post', '/households', owner.auth).send({ name: 'Dar Benali' });
  expect(res.status).toBe(201);
  const household = res.body.data.household;
  const others = [];
  for (const role of extraRoles) {
    const person = await createSignedInUser(ctx, { fullName: role });
    const member = await prisma.householdMember.create({
      data: { householdId: household.id, userId: person.user.id, role },
    });
    others.push({ ...person, memberId: member.id, role });
  }
  const ownerMember = await prisma.householdMember.findFirst({
    where: { householdId: household.id, userId: owner.user.id },
  });
  return { household, owner: { ...owner, memberId: ownerMember.id }, others };
}

describe('POST /households', () => {
  it('creates a household with the creator as OWNER and sensible defaults', async () => {
    const owner = await createSignedInUser(ctx);
    const res = await api('post', '/households', owner.auth).send({ name: '  Dar Benali ' });

    expect(res.status).toBe(201);
    expect(res.body.data.household).toMatchObject({
      name: 'Dar Benali',
      description: null,
      currency: 'MAD',
      timezone: 'Africa/Casablanca',
      myRole: 'OWNER',
      memberCount: 1,
    });
    expect(res.body.data.household.permissions).toContain('household:delete');
    expect(await prisma.auditLog.count({ where: { action: 'household.created' } })).toBe(1);
  });

  it('validates currency and time zone against real ISO/IANA lists', async () => {
    const owner = await createSignedInUser(ctx);
    const res = await api('post', '/households', owner.auth).send({
      name: 'Home',
      currency: 'XYZ',
      timezone: 'Africa/Casablnca',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'currency', code: 'invalid_currency' },
        { field: 'timezone', code: 'invalid_timezone' },
      ]),
    );
  });

  it('rejects client-supplied ownership fields', async () => {
    const owner = await createSignedInUser(ctx);
    const res = await api('post', '/households', owner.auth).send({ name: 'Home', ownerId: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ code: 'unrecognized_keys' });
  });

  it('requires authentication', async () => {
    expect((await api('post', '/households').send({ name: 'Home' })).status).toBe(401);
  });
});

describe('GET /households', () => {
  it('lists only the households the user belongs to, with role and member count', async () => {
    const { owner, others } = await setupHousehold(['MEMBER']);
    const stranger = await createSignedInUser(ctx);
    await api('post', '/households', stranger.auth).send({ name: 'Other home' });

    const mine = await api('get', '/households', owner.auth);
    expect(mine.body.data.households).toHaveLength(1);
    expect(mine.body.data.households[0]).toMatchObject({ myRole: 'OWNER', memberCount: 2 });

    const asMember = await api('get', '/households', others[0].auth);
    expect(asMember.body.data.households[0]).toMatchObject({
      myRole: 'MEMBER',
      permissions: ['household:read', 'members:read'],
    });
  });
});

describe('household isolation', () => {
  it('answers 404 — identical to a missing household — to non-members', async () => {
    const { household } = await setupHousehold();
    const stranger = await createSignedInUser(ctx);

    const foreign = await api('get', `/households/${household.id}`, stranger.auth);
    const missing = await api(
      'get',
      '/households/00000000-0000-7000-8000-000000000000',
      stranger.auth,
    );
    const malformed = await api('get', '/households/not-a-uuid', stranger.auth);

    for (const res of [foreign, missing, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('HOUSEHOLD_NOT_FOUND');
    }
    for (const path of ['members', '']) {
      const res = await api('get', `/households/${household.id}/${path}`, stranger.auth);
      expect(res.status).toBe(404);
    }
    const patch = await api('patch', `/households/${household.id}`, stranger.auth).send({
      name: 'Hacked',
    });
    expect(patch.status).toBe(404);
  });

  it('cannot reach a member of another household through my own household id', async () => {
    const mine = await setupHousehold();
    const theirs = await setupHousehold(['MEMBER']);

    const res = await api(
      'delete',
      `/households/${mine.household.id}/members/${theirs.others[0].memberId}`,
      mine.owner.auth,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
    expect(await prisma.householdMember.count({ where: { id: theirs.others[0].memberId } })).toBe(
      1,
    );
  });
});

describe('role permissions matrix', () => {
  const cases = [
    // [action, OWNER, ADMIN, MEMBER]
    ['read household', 200, 200, 200],
    ['list members', 200, 200, 200],
    ['update household', 200, 403, 403],
    ['delete household', 204, 403, 403],
  ];

  async function perform(action, actor, household) {
    const base = `/households/${household.id}`;
    switch (action) {
      case 'read household':
        return api('get', base, actor.auth);
      case 'list members':
        return api('get', `${base}/members`, actor.auth);
      case 'update household':
        return api('patch', base, actor.auth).send({ name: 'Renamed' });
      case 'delete household':
        return api('delete', base, actor.auth).send({ confirmName: household.name });
      default:
        throw new Error(action);
    }
  }

  it.each(cases)('%s → OWNER %i, ADMIN %i, MEMBER %i', async (action, ...expected) => {
    for (const [index, role] of ['OWNER', 'ADMIN', 'MEMBER'].entries()) {
      await resetDatabase(prisma);
      const { household, owner, others } = await setupHousehold(['ADMIN', 'MEMBER']);
      const actor = role === 'OWNER' ? owner : others.find((o) => o.role === role);
      const res = await perform(action, actor, household);
      expect({ role, status: res.status }).toEqual({ role, status: expected[index] });
    }
  });
});

describe('PATCH /households/:id', () => {
  it('updates settings, clears the description with an empty string, and audits fields', async () => {
    const { household, owner } = await setupHousehold();
    await api('patch', `/households/${household.id}`, owner.auth).send({
      description: 'Notre maison',
    });

    const res = await api('patch', `/households/${household.id}`, owner.auth).send({
      currency: 'eur',
      timezone: 'Europe/Paris',
      description: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.household).toMatchObject({
      currency: 'EUR',
      timezone: 'Europe/Paris',
      description: null,
    });
    const log = await prisma.auditLog.findFirst({
      where: { action: 'household.updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect([...log.metadata.fields].sort()).toEqual(['currency', 'description', 'timezone']);
  });

  it('rejects an empty update', async () => {
    const { household, owner } = await setupHousehold();
    const res = await api('patch', `/households/${household.id}`, owner.auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('empty_update');
  });
});

describe('DELETE /households/:id', () => {
  it('requires the exact name, then deletes memberships but keeps the audit trail', async () => {
    const { household, owner, others } = await setupHousehold(['MEMBER']);

    const wrong = await api('delete', `/households/${household.id}`, owner.auth).send({
      confirmName: 'dar benali',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('CONFIRMATION_MISMATCH');

    const res = await api('delete', `/households/${household.id}`, owner.auth).send({
      confirmName: 'Dar Benali',
    });
    expect(res.status).toBe(204);
    expect(await prisma.householdMember.count()).toBe(0);
    expect((await api('get', `/households/${household.id}`, others[0].auth)).status).toBe(404);
    expect(
      await prisma.auditLog.count({ where: { householdId: household.id } }),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /households/:id/members', () => {
  it('lists members owner-first with public user fields only', async () => {
    const { household, owner } = await setupHousehold(['MEMBER', 'ADMIN']);
    const res = await api('get', `/households/${household.id}/members`, owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.members.map((m) => m.role)).toEqual(['OWNER', 'ADMIN', 'MEMBER']);
    expect(Object.keys(res.body.data.members[0].user).sort()).toEqual([
      'avatarUrl',
      'email',
      'fullName',
      'id',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('PATCH /households/:id/members/:memberId (roles)', () => {
  const changeRole = (household, actor, target, role) =>
    api('patch', `/households/${household.id}/members/${target.memberId}`, actor.auth).send({
      role,
    });

  it('lets an owner promote a member to admin, and an admin to co-owner', async () => {
    const { household, owner, others } = await setupHousehold(['MEMBER']);
    const [person] = others;

    const toAdmin = await changeRole(household, owner, person, 'ADMIN');
    expect(toAdmin.status).toBe(200);
    expect(toAdmin.body.data.member.role).toBe('ADMIN');

    expect((await changeRole(household, owner, person, 'OWNER')).status).toBe(200);
    const log = await prisma.auditLog.findFirst({
      where: { action: 'member.role_changed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log.metadata).toMatchObject({ from: 'ADMIN', to: 'OWNER' });
  });

  it.each([
    ['promote a member to admin', 'MEMBER', 'ADMIN'],
    ['promote a member to owner', 'MEMBER', 'OWNER'],
    ['demote another admin', 'ADMIN', 'MEMBER'],
  ])('forbids an admin to %s', async (_label, targetRole, newRole) => {
    const { household, others } = await setupHousehold(['ADMIN', targetRole]);
    const [admin, target] = others;
    const res = await changeRole(household, admin, target, newRole);
    expect(res.status).toBe(403);
  });

  it('forbids an admin to change an owner or promote themselves', async () => {
    const { household, owner, others } = await setupHousehold(['ADMIN']);
    const [admin] = others;
    expect((await changeRole(household, admin, owner, 'MEMBER')).status).toBe(403);
    expect((await changeRole(household, admin, admin, 'OWNER')).status).toBe(403);
  });

  it('forbids members from changing any role', async () => {
    const { household, owner, others } = await setupHousehold(['MEMBER']);
    const [member] = others;
    expect((await changeRole(household, member, member, 'ADMIN')).status).toBe(403);
    expect((await changeRole(household, member, owner, 'MEMBER')).status).toBe(403);
  });

  it('never lets the last owner step down, but a co-owner can', async () => {
    const { household, owner, others } = await setupHousehold(['MEMBER']);
    const alone = await changeRole(household, owner, owner, 'ADMIN');
    expect(alone.status).toBe(409);
    expect(alone.body.error.code).toBe('LAST_OWNER');

    await changeRole(household, owner, others[0], 'OWNER');
    expect((await changeRole(household, owner, owner, 'MEMBER')).status).toBe(200);
  });

  it('keeps at least one owner when two owners demote each other at the same time', async () => {
    const { household, owner, others } = await setupHousehold(['OWNER']);
    const [coOwner] = others;

    const results = await Promise.all([
      changeRole(household, owner, coOwner, 'MEMBER'),
      changeRole(household, coOwner, owner, 'MEMBER'),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 403]); // the loser is no longer an owner when its turn comes
    expect(
      await prisma.householdMember.count({ where: { householdId: household.id, role: 'OWNER' } }),
    ).toBe(1);
  });

  it('rejects unknown roles', async () => {
    const { household, owner, others } = await setupHousehold(['MEMBER']);
    const res = await changeRole(household, owner, others[0], 'SUPERADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('invalid_role');
  });
});

describe('DELETE /households/:id/members/:memberId', () => {
  const remove = (household, actor, target) =>
    api('delete', `/households/${household.id}/members/${target.memberId}`, actor.auth);

  it('lets any member leave, after which they lose access', async () => {
    const { household, others } = await setupHousehold(['MEMBER']);
    const [member] = others;
    expect((await remove(household, member, member)).status).toBe(204);
    expect((await api('get', `/households/${household.id}`, member.auth)).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: 'member.left' } })).toBe(1);
  });

  it('follows the hierarchy when removing others', async () => {
    const { household, owner, others } = await setupHousehold([
      'ADMIN',
      'ADMIN',
      'MEMBER',
      'MEMBER',
    ]);
    const [admin, otherAdmin, member, otherMember] = others;

    expect((await remove(household, member, otherMember)).status).toBe(403);
    expect((await remove(household, admin, otherAdmin)).status).toBe(403);
    expect((await remove(household, admin, owner)).status).toBe(403);
    expect((await remove(household, admin, member)).status).toBe(204);
    expect((await remove(household, owner, otherAdmin)).status).toBe(204);
    expect(await prisma.auditLog.count({ where: { action: 'member.removed' } })).toBe(2);
  });

  it('never lets the last owner leave', async () => {
    const { household, owner } = await setupHousehold(['ADMIN']);
    const res = await remove(household, owner, owner);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });
});
