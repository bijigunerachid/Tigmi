import request from 'supertest';
import {
  createSignedInUser,
  createTestContext,
  emailsTo,
  resetDatabase,
  tokenFromEmail,
} from '../helpers/test-app.js';

const ctx = createTestContext({ security: { emailCooldownSeconds: 60 } });
const { app, prisma } = ctx;

beforeEach(async () => {
  await ctx.mail.flush();
  ctx.outbox.length = 0;
  await resetDatabase(prisma);
});
afterAll(() => prisma.$disconnect());

const api = (method, path, auth) => {
  const req = request(app)[method](`/api/v1${path}`);
  return auth ? req.set('Authorization', auth) : req;
};

async function setup() {
  const owner = await createSignedInUser(ctx, { fullName: 'Amina' });
  const res = await api('post', '/households', owner.auth).send({ name: 'Dar Benali' });
  return { owner, household: res.body.data.household };
}

const invite = (household, actor, body) =>
  api('post', `/households/${household.id}/invitations`, actor.auth).send(body);

async function addMember(household, role) {
  const person = await createSignedInUser(ctx, { fullName: role });
  await prisma.householdMember.create({
    data: { householdId: household.id, userId: person.user.id, role },
  });
  return person;
}

/** Lets the per-email cooldown pass without sleeping. */
const ageInvitations = () =>
  prisma.invitation.updateMany({ data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } });

async function inviteAndGetToken(household, actor, email, role = 'MEMBER') {
  const res = await invite(household, actor, { email, role });
  expect(res.status).toBe(201);
  const sent = await emailsTo(ctx, email);
  return tokenFromEmail(sent.at(-1));
}

describe('POST /households/:id/invitations', () => {
  it('creates a pending invitation and emails a single-use link', async () => {
    const { owner, household } = await setup();
    const res = await invite(household, owner, { email: ' Youssef@Example.com ' });

    expect(res.status).toBe(201);
    expect(res.body.data.invitation).toMatchObject({
      email: 'youssef@example.com',
      role: 'MEMBER',
      status: 'pending',
      invitedBy: { fullName: 'Amina' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);

    const [email] = await emailsTo(ctx, 'youssef@example.com');
    expect(email.subject).toBe('Amina vous invite à rejoindre « Dar Benali » sur Tigmi');
    expect(email.text).toContain('Bonjour,'); // no account yet → no name
    expect(email.text).toMatch(/http:\/\/localhost:5180\/invitations\/accept#token=[\w-]{43}/);

    const stored = await prisma.invitation.findFirst();
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.tokenHash).not.toBe(tokenFromEmail(email));
    expect(await prisma.auditLog.count({ where: { action: 'invitation.sent' } })).toBe(1);
  });

  it('writes to existing users by name and in their own language', async () => {
    const { owner, household } = await setup();
    const youssef = await createSignedInUser(ctx, { fullName: 'يوسف' });
    await prisma.user.update({ where: { id: youssef.user.id }, data: { preferredLanguage: 'ar' } });

    await invite(household, owner, { email: youssef.user.email });
    const [email] = await emailsTo(ctx, youssef.user.email);
    expect(email.subject).toBe('Amina يدعوك للانضمام إلى «Dar Benali» على Tigmi');
    expect(email.text).toContain('مرحبًا يوسف،');
    expect(email.html).toContain('dir="rtl"');
  });

  it('refuses self-invitations and people who are already members', async () => {
    const { owner, household } = await setup();
    const member = await addMember(household, 'MEMBER');

    const self = await invite(household, owner, { email: owner.user.email.toUpperCase() });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_INVITE_SELF');

    const existing = await invite(household, owner, { email: member.user.email });
    expect(existing.status).toBe(409);
    expect(existing.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('applies role rules: owners invite admins, admins only members, nobody invites owners', async () => {
    const { owner, household } = await setup();
    const admin = await addMember(household, 'ADMIN');
    const member = await addMember(household, 'MEMBER');

    expect((await invite(household, owner, { email: 'a@example.com', role: 'ADMIN' })).status).toBe(
      201,
    );
    expect(
      (await invite(household, admin, { email: 'b@example.com', role: 'MEMBER' })).status,
    ).toBe(201);
    expect((await invite(household, admin, { email: 'c@example.com', role: 'ADMIN' })).status).toBe(
      403,
    );
    expect((await invite(household, member, { email: 'd@example.com' })).status).toBe(403);
    const asOwner = await invite(household, owner, { email: 'e@example.com', role: 'OWNER' });
    expect(asOwner.status).toBe(400);
    expect(asOwner.body.error.details[0].code).toBe('invalid_role');
  });

  it('is invisible to non-members (404)', async () => {
    const { household } = await setup();
    const stranger = await createSignedInUser(ctx);
    const res = await invite(household, stranger, { email: 'x@example.com' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('HOUSEHOLD_NOT_FOUND');
  });

  it('re-inviting replaces the previous link, with a per-address cooldown', async () => {
    const { owner, household } = await setup();
    const first = await inviteAndGetToken(household, owner, 'youssef@example.com');

    const tooSoon = await invite(household, owner, { email: 'youssef@example.com' });
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('INVITATION_RECENTLY_SENT');
    expect(Number(tooSoon.headers['retry-after'])).toBeGreaterThan(0);

    await ageInvitations();
    const second = await inviteAndGetToken(household, owner, 'youssef@example.com');
    expect(second).not.toBe(first);
    expect((await api('post', '/invitations/preview').send({ token: first })).status).toBe(400);
    expect((await api('post', '/invitations/preview').send({ token: second })).status).toBe(200);
  });

  it('caps members + pending invitations per household', async () => {
    const small = createTestContext({ security: { maxHouseholdMembers: 3 } });
    const owner = await createSignedInUser(small);
    const { household } = (
      await request(small.app)
        .post('/api/v1/households')
        .set('Authorization', owner.auth)
        .send({ name: 'Small home' })
    ).body.data;
    const send = (email) =>
      request(small.app)
        .post(`/api/v1/households/${household.id}/invitations`)
        .set('Authorization', owner.auth)
        .send({ email });

    expect((await send('one@example.com')).status).toBe(201);
    expect((await send('two@example.com')).status).toBe(201); // 1 member + 2 pending = 3
    const full = await send('three@example.com');
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('HOUSEHOLD_FULL');
    await small.mail.flush();
    await small.prisma.$disconnect();
  });
});

describe('GET and DELETE /households/:id/invitations', () => {
  it('lists outstanding invitations and lets the inviter cancel one', async () => {
    const { owner, household } = await setup();
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com');

    const list = await api('get', `/households/${household.id}/invitations`, owner.auth);
    expect(list.body.data.invitations).toHaveLength(1);
    const [{ id }] = list.body.data.invitations;

    const revoked = await api(
      'delete',
      `/households/${household.id}/invitations/${id}`,
      owner.auth,
    );
    expect(revoked.status).toBe(204);
    expect((await api('post', '/invitations/preview').send({ token })).status).toBe(400);
    expect(
      (await api('get', `/households/${household.id}/invitations`, owner.auth)).body.data
        .invitations,
    ).toEqual([]);

    const again = await api('delete', `/households/${household.id}/invitations/${id}`, owner.auth);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVITATION_NOT_PENDING');
  });

  it('forbids members from seeing invitations and admins from cancelling admin invitations', async () => {
    const { owner, household } = await setup();
    const admin = await addMember(household, 'ADMIN');
    const member = await addMember(household, 'MEMBER');
    await invite(household, owner, { email: 'future-admin@example.com', role: 'ADMIN' });
    const [{ id }] = (await api('get', `/households/${household.id}/invitations`, owner.auth)).body
      .data.invitations;

    expect((await api('get', `/households/${household.id}/invitations`, member.auth)).status).toBe(
      403,
    );
    expect(
      (await api('delete', `/households/${household.id}/invitations/${id}`, admin.auth)).status,
    ).toBe(403);
  });

  it('cannot cancel an invitation of another household', async () => {
    const mine = await setup();
    const theirs = await setup();
    await invite(theirs.household, theirs.owner, { email: 'x@example.com' });
    const theirId = (await prisma.invitation.findFirst()).id;

    const res = await api(
      'delete',
      `/households/${mine.household.id}/invitations/${theirId}`,
      mine.owner.auth,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });
});

describe('invitee flow', () => {
  it('previews the invitation without an account', async () => {
    const { owner, household } = await setup();
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com', 'ADMIN');

    const res = await api('post', '/invitations/preview').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.data.invitation).toMatchObject({
      householdName: 'Dar Benali',
      invitedBy: 'Amina',
      email: 'youssef@example.com',
      role: 'ADMIN',
    });
  });

  it('joins the household with the invited role, once', async () => {
    const { owner, household } = await setup();
    const youssef = await createSignedInUser(ctx, { email: 'youssef@example.com' });
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com', 'ADMIN');

    const res = await api('post', '/invitations/accept', youssef.auth).send({ token });
    expect(res.status).toBe(200);
    expect(res.body.data.household).toMatchObject({
      id: household.id,
      myRole: 'ADMIN',
      memberCount: 2,
    });
    expect((await api('get', `/households/${household.id}`, youssef.auth)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'invitation.accepted' } })).toBe(1);

    const again = await api('post', '/invitations/accept', youssef.auth).send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('refuses a forwarded link used by a different account', async () => {
    const { owner, household } = await setup();
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com');
    const someoneElse = await createSignedInUser(ctx, { email: 'mallory@example.com' });

    const res = await api('post', '/invitations/accept', someoneElse.auth).send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    // The link is not used up: the real invitee can still accept it.
    expect((await api('post', '/invitations/preview').send({ token })).status).toBe(200);
  });

  it('requires signing in to accept', async () => {
    const { owner, household } = await setup();
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com');
    expect((await api('post', '/invitations/accept').send({ token })).status).toBe(401);
  });

  it('rejects expired, unknown and malformed tokens', async () => {
    const { owner, household } = await setup();
    const youssef = await createSignedInUser(ctx, { email: 'youssef@example.com' });
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com');
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await api('post', '/invitations/accept', youssef.auth).send({ token })).status).toBe(
      400,
    );
    expect(
      (await api('post', '/invitations/preview').send({ token: 'x'.repeat(43) })).body.error.code,
    ).toBe('INVALID_OR_EXPIRED_TOKEN');
    expect((await api('post', '/invitations/preview').send({ token: 'short' })).status).toBe(400);

    const list = await api('get', `/households/${household.id}/invitations`, owner.auth);
    expect(list.body.data.invitations[0].status).toBe('expired');
  });

  it('lets only one of two simultaneous accepts succeed', async () => {
    const { owner, household } = await setup();
    const youssef = await createSignedInUser(ctx, { email: 'youssef@example.com' });
    const token = await inviteAndGetToken(household, owner, 'youssef@example.com');

    const results = await Promise.all([
      api('post', '/invitations/accept', youssef.auth).send({ token }),
      api('post', '/invitations/accept', youssef.auth).send({ token }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.householdMember.count({ where: { householdId: household.id } })).toBe(2);
  });
});
