import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiError,
  json,
  mockApi,
  renderRoute,
  setSessionCookie,
  signedInUser,
} from '../../test/render.jsx';

const TOKEN = 'T'.repeat(43);

describe('Login page', () => {
  it('shows French validation messages without calling the API', async () => {
    const fetchMock = mockApi({});
    renderRoute('/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Saisissez une adresse e-mail valide.')).toBeInTheDocument();
    expect(screen.getByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in and goes to the page that was requested', async () => {
    const fetchMock = mockApi({
      'POST /auth/login': () =>
        json(200, { data: { user: signedInUser, accessToken: 'access', csrfToken: 'csrf' } }),
      'GET /households': () => json(200, { data: { households: [] } }),
    });
    const { router } = renderRoute('/login?next=%2F');

    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'AMINA@example.com ');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'a long family passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Mes foyers' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/login'));
    expect(JSON.parse(loginCall[1].body).email).toBe('amina@example.com'); // shared schema normalised it
  });

  it('never redirects outside the app after sign-in', async () => {
    mockApi({
      'POST /auth/login': () =>
        json(200, { data: { user: signedInUser, accessToken: 'access', csrfToken: 'csrf' } }),
      'GET /households': () => json(200, { data: { households: [] } }),
    });
    const { router } = renderRoute('/login?next=%2F%2Fevil.example');

    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'amina@example.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'a long family passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await screen.findByRole('heading', { name: 'Mes foyers' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('explains wrong credentials and offers to resend an unverified email', async () => {
    let attempt = 0;
    const fetchMock = mockApi({
      'POST /auth/login': () => {
        attempt += 1;
        return attempt === 1
          ? apiError(401, 'INVALID_CREDENTIALS')
          : apiError(403, 'EMAIL_NOT_VERIFIED');
      },
      'POST /auth/resend-verification': () => json(202, { data: { status: 'check_email' } }),
    });
    renderRoute('/login');

    await userEvent.type(await screen.findByLabelText('Adresse e-mail'), 'amina@example.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Adresse e-mail ou mot de passe incorrect.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Renvoyer l’e-mail de confirmation' }),
    );
    expect(await screen.findByText(/un nouvel e-mail vient d’être envoyé/)).toBeInTheDocument();
    const resend = fetchMock.mock.calls.find(([url]) => url.endsWith('/resend-verification'));
    expect(JSON.parse(resend[1].body)).toEqual({ email: 'amina@example.com' });
  });
});

describe('Language switch', () => {
  it('turns the whole document right-to-left in Arabic and back', async () => {
    mockApi({});
    renderRoute('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'العربية' }));
    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');

    await userEvent.click(screen.getByRole('button', { name: 'Français' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'ltr'));
  });
});

describe('Register page', () => {
  it('creates the account and shows "check your email"', async () => {
    mockApi({ 'POST /auth/register': () => json(202, { data: { status: 'check_email' } }) });
    renderRoute('/register');

    await userEvent.type(await screen.findByLabelText('Nom complet'), 'Amina Benali');
    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'amina@example.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'a long family passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      await screen.findByRole('heading', { name: 'Vérifiez votre boîte de réception' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/amina@example.com/)).toBeInTheDocument();
  });

  it('creates the account in the language chosen on the page', async () => {
    const fetchMock = mockApi({
      'POST /auth/register': () => json(202, { data: { status: 'check_email' } }),
    });
    renderRoute('/register');
    await userEvent.click(await screen.findByRole('button', { name: 'العربية' }));

    await userEvent.type(await screen.findByLabelText('الاسم الكامل'), 'أمينة بنعلي');
    await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'amina@example.com');
    await userEvent.type(screen.getByLabelText('كلمة المرور'), 'a long family passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'إنشاء حسابي' }));

    await screen.findByRole('heading', { name: 'تحقّق من بريدك الوارد' });
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/register'));
    expect(JSON.parse(call[1].body).preferredLanguage).toBe('ar');
  });

  it('applies the shared password rules', async () => {
    mockApi({});
    renderRoute('/register');
    await userEvent.type(await screen.findByLabelText('Nom complet'), 'Amina');
    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'amina@example.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 12 caractères.'),
    ).toBeInTheDocument();
  });

  it('lets people reveal the password they typed', async () => {
    mockApi({});
    renderRoute('/register');
    const field = await screen.findByLabelText('Mot de passe');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(field).toHaveAttribute('type', 'text');
  });
});

describe('Verify email page (emailed link)', () => {
  it('verifies once — even in StrictMode — and removes the token from the address bar', async () => {
    const fetchMock = mockApi({ 'POST /auth/verify-email': () => json(204) });
    renderRoute(`/verify-email#token=${TOKEN}`);

    expect(await screen.findByText(/Votre adresse e-mail est confirmée/)).toBeInTheDocument();
    const calls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/verify-email'));
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toEqual({ token: TOKEN });
    expect(window.location.hash).toBe('');
  });

  it('explains an expired link', async () => {
    mockApi({ 'POST /auth/verify-email': () => apiError(400, 'INVALID_OR_EXPIRED_TOKEN') });
    renderRoute(`/verify-email#token=${TOKEN}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce lien est invalide, a expiré ou a déjà été utilisé.',
    );
  });

  it('handles a link without token', async () => {
    mockApi({});
    renderRoute('/verify-email');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce lien est incomplet.');
  });
});

describe('Reset password page (emailed link)', () => {
  it('sets the new password', async () => {
    const fetchMock = mockApi({ 'POST /auth/reset-password': () => json(204) });
    renderRoute(`/reset-password#token=${TOKEN}`);

    await userEvent.type(
      await screen.findByLabelText('Nouveau mot de passe'),
      'a brand new family passphrase',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    expect(await screen.findByText(/Votre mot de passe a été modifié/)).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/reset-password'));
    expect(JSON.parse(call[1].body)).toEqual({
      token: TOKEN,
      password: 'a brand new family passphrase',
    });
  });
});

describe('Session restore', () => {
  it('restores the session from the refresh cookie on page load', async () => {
    setSessionCookie(true);
    mockApi({
      'POST /auth/refresh': () =>
        json(200, { data: { user: signedInUser, accessToken: 'access', csrfToken: 'csrf' } }),
      'GET /households': () => json(200, { data: { households: [] } }),
    });
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Mes foyers' })).toBeInTheDocument();
    expect(screen.getByText('Bonjour, Amina')).toBeInTheDocument();
  });

  it('sends signed-out visitors of private pages to the login page and back', async () => {
    mockApi({});
    const { router } = renderRoute('/households/abc');
    await screen.findByRole('heading', { name: 'Connexion' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fhouseholds%2Fabc');
  });
});
