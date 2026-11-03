import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiError,
  json,
  mockApi,
  renderRoute,
  setSessionCookie,
  signedInUser,
} from '../../test/render.jsx';

const TOKEN = 'I'.repeat(43);
const HOUSEHOLD_ID = '0195f0a0-0000-7000-8000-0000000000aa';

const session = {
  'POST /auth/refresh': () =>
    json(200, { data: { user: signedInUser, accessToken: 'access', csrfToken: 'csrf' } }),
};

const household = (role) => ({
  id: HOUSEHOLD_ID,
  name: 'Dar Benali',
  description: null,
  currency: 'MAD',
  timezone: 'Africa/Casablanca',
  myRole: role,
  permissions:
    role === 'MEMBER'
      ? ['household:read', 'members:read']
      : ['household:read', 'members:read', 'members:manage', 'members:invite'],
  memberCount: 1,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
});

const members = [
  {
    id: 'm1',
    role: 'OWNER',
    joinedAt: '2026-11-01T10:00:00.000Z',
    user: {
      id: signedInUser.id,
      fullName: 'Amina Benali',
      email: 'amina@example.com',
      avatarUrl: null,
    },
  },
];

beforeEach(() => setSessionCookie(true));

describe('Households page', () => {
  it('shows an empty state and creates the first household', async () => {
    const created = household('OWNER');
    const fetchMock = mockApi({
      ...session,
      'GET /households': () => json(200, { data: { households: [] } }),
      'POST /households': () => json(201, { data: { household: created } }),
      [`GET /households/${HOUSEHOLD_ID}`]: () => json(200, { data: { household: created } }),
      [`GET /households/${HOUSEHOLD_ID}/members`]: () => json(200, { data: { members } }),
      [`GET /households/${HOUSEHOLD_ID}/invitations`]: () =>
        json(200, { data: { invitations: [] } }),
    });
    renderRoute('/');

    expect(
      await screen.findByText(/Vous ne faites encore partie d’aucun foyer/),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nom du foyer'), 'Dar Benali');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le foyer' }));

    expect(
      await screen.findByRole('heading', { name: 'Dar Benali', level: 1 }),
    ).toBeInTheDocument();
    const create = fetchMock.mock.calls.find(
      ([url, init]) => url.endsWith('/households') && init.method === 'POST',
    );
    expect(JSON.parse(create[1].body)).toEqual({ name: 'Dar Benali' });
    expect(create[1].headers.Authorization).toBe('Bearer access');
  });

  it('offers a retry when the list cannot be loaded', async () => {
    mockApi({ ...session, 'GET /households': () => apiError(500, 'INTERNAL_ERROR') });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos foyers.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('Household page', () => {
  it('lets an owner invite as admin or member and lists pending invitations', async () => {
    const fetchMock = mockApi({
      ...session,
      [`GET /households/${HOUSEHOLD_ID}`]: () =>
        json(200, { data: { household: household('OWNER') } }),
      [`GET /households/${HOUSEHOLD_ID}/members`]: () => json(200, { data: { members } }),
      [`GET /households/${HOUSEHOLD_ID}/invitations`]: () =>
        json(200, { data: { invitations: [] } }),
      [`POST /households/${HOUSEHOLD_ID}/invitations`]: (body) =>
        json(201, { data: { invitation: { id: 'i1', email: body.email, role: body.role } } }),
    });
    renderRoute(`/households/${HOUSEHOLD_ID}`);

    const membersRegion = await screen.findByRole('region', { name: 'Membres' });
    expect(await within(membersRegion).findByText('Amina Benali')).toBeInTheDocument();
    expect(within(membersRegion).getByText('(vous)')).toBeInTheDocument();

    const role = screen.getByLabelText('Rôle');
    expect(
      within(role)
        .getAllByRole('option')
        .map((o) => o.value),
    ).toEqual(['MEMBER', 'ADMIN']);

    await userEvent.type(
      screen.getByLabelText('Adresse e-mail de la personne'),
      'Youssef@Example.com',
    );
    await userEvent.selectOptions(role, 'ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));

    expect(
      await screen.findByText('Invitation envoyée à youssef@example.com.'),
    ).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url.endsWith('/invitations') && init.method === 'POST',
    );
    expect(JSON.parse(call[1].body)).toEqual({ email: 'youssef@example.com', role: 'ADMIN' });
  });

  it('shows translated API errors under the invite form', async () => {
    mockApi({
      ...session,
      [`GET /households/${HOUSEHOLD_ID}`]: () =>
        json(200, { data: { household: household('ADMIN') } }),
      [`GET /households/${HOUSEHOLD_ID}/members`]: () => json(200, { data: { members } }),
      [`GET /households/${HOUSEHOLD_ID}/invitations`]: () =>
        json(200, { data: { invitations: [] } }),
      [`POST /households/${HOUSEHOLD_ID}/invitations`]: () => apiError(409, 'ALREADY_MEMBER'),
    });
    renderRoute(`/households/${HOUSEHOLD_ID}`);

    const role = await screen.findByLabelText('Rôle');
    expect(
      within(role)
        .getAllByRole('option')
        .map((o) => o.value),
    ).toEqual(['MEMBER']); // admins
    await userEvent.type(screen.getByLabelText('Adresse e-mail de la personne'), 'x@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette personne fait déjà partie du foyer.',
    );
  });

  it('hides invitation tools from members', async () => {
    mockApi({
      ...session,
      [`GET /households/${HOUSEHOLD_ID}`]: () =>
        json(200, { data: { household: household('MEMBER') } }),
      [`GET /households/${HOUSEHOLD_ID}/members`]: () => json(200, { data: { members } }),
    });
    renderRoute(`/households/${HOUSEHOLD_ID}`);
    await screen.findByRole('region', { name: 'Membres' });
    expect(screen.queryByRole('region', { name: 'Inviter quelqu’un' })).not.toBeInTheDocument();
  });

  it('explains a household that does not exist or is not shared with me', async () => {
    mockApi({
      ...session,
      [`GET /households/${HOUSEHOLD_ID}`]: () => apiError(404, 'HOUSEHOLD_NOT_FOUND'),
    });
    renderRoute(`/households/${HOUSEHOLD_ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce foyer n’existe pas ou vous n’y avez pas accès.',
    );
  });
});

describe('Accept invitation page', () => {
  const preview = {
    householdName: 'Dar Benali',
    invitedBy: 'Amina Benali',
    email: 'youssef@example.com',
    role: 'ADMIN',
    expiresAt: '2026-11-10T10:00:00.000Z',
  };

  it('guides a signed-out invitee to sign in or create the account', async () => {
    setSessionCookie(false);
    mockApi({ 'POST /invitations/preview': () => json(200, { data: { invitation: preview } }) });
    renderRoute(`/invitations/accept#token=${TOKEN}`);

    expect(
      await screen.findByText(
        'Amina Benali vous invite à rejoindre le foyer « Dar Benali » en tant que administrateur.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/login?next=%2Finvitations%2Faccept',
    );
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem('tigmi.pendingInvitation')).toBe(TOKEN);
  });

  it('warns when signed in with a different address', async () => {
    mockApi({
      ...session,
      'POST /invitations/preview': () => json(200, { data: { invitation: preview } }),
    });
    renderRoute(`/invitations/accept#token=${TOKEN}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous êtes connecté avec amina@example.com, mais l’invitation a été envoyée à youssef@example.com.',
    );
    expect(screen.queryByRole('button', { name: 'Rejoindre le foyer' })).not.toBeInTheDocument();
  });

  it('accepts with the right account and opens the household', async () => {
    const forAmina = { ...preview, email: signedInUser.email };
    mockApi({
      ...session,
      'POST /invitations/preview': () => json(200, { data: { invitation: forAmina } }),
      'POST /invitations/accept': () => json(200, { data: { household: household('ADMIN') } }),
      [`GET /households/${HOUSEHOLD_ID}`]: () =>
        json(200, { data: { household: household('ADMIN') } }),
      [`GET /households/${HOUSEHOLD_ID}/members`]: () => json(200, { data: { members } }),
      [`GET /households/${HOUSEHOLD_ID}/invitations`]: () =>
        json(200, { data: { invitations: [] } }),
    });
    const { router } = renderRoute(`/invitations/accept#token=${TOKEN}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Rejoindre le foyer' }));
    expect(
      await screen.findByRole('heading', { name: 'Dar Benali', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/households/${HOUSEHOLD_ID}`);
    expect(window.sessionStorage.getItem('tigmi.pendingInvitation')).toBeNull();
  });

  it('explains an expired invitation', async () => {
    setSessionCookie(false);
    mockApi({ 'POST /invitations/preview': () => apiError(400, 'INVALID_OR_EXPIRED_TOKEN') });
    renderRoute(`/invitations/accept#token=${TOKEN}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalide, a expiré ou a déjà été utilisée/,
    );
  });
});
