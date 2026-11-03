import { useEffect } from 'react';
import { Outlet, createBrowserRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useTranslation } from 'react-i18next';
import { hasChosenLanguage, setLanguage } from '../lib/i18n.js';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { CheckEmailPage } from '../features/auth/CheckEmailPage.jsx';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.jsx';
import { GuestOnly, RequireAuth } from '../features/auth/guards.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { RegisterPage } from '../features/auth/RegisterPage.jsx';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.jsx';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage.jsx';
import { HouseholdPage } from '../features/households/HouseholdPage.jsx';
import { HouseholdsPage } from '../features/households/HouseholdsPage.jsx';
import { AcceptInvitationPage } from '../features/invitations/AcceptInvitationPage.jsx';
import { SystemStatus } from '../features/system/SystemStatus.jsx';
import { NotFoundPage } from './NotFoundPage.jsx';

/** Moves keyboard/screen-reader focus to the page heading after each navigation. */
function RouteAnnouncer() {
  const location = useLocation();
  useEffect(() => {
    document.querySelector('main h1')?.setAttribute('tabindex', '-1');
    document.querySelector('main h1')?.focus({ preventScroll: true });
  }, [location.pathname]);
  return null;
}

/** Keeps <html lang/dir> and the title in sync with the language (Arabic → rtl in Phase 3). */
function Root() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // After sign-in, use the account's language unless this device already has an explicit choice.
  useEffect(() => {
    if (user?.preferredLanguage && !hasChosenLanguage()) {
      setLanguage(user.preferredLanguage, { remember: false });
    }
  }, [user?.preferredLanguage]);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir(i18n.language);
    document.title = t('app.name');
  }, [i18n, i18n.language, t]);
  return (
    <>
      <RouteAnnouncer />
      <Outlet />
    </>
  );
}

export const routes = [
  {
    element: <Root />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            element: <GuestOnly />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <RegisterPage /> },
              { path: '/check-email', element: <CheckEmailPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
          // Emailed links work whether or not someone is signed in.
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
          { path: '/invitations/accept', element: <AcceptInvitationPage /> },
          { path: '/status', element: <SystemStatus /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // Component gallery: development builds only (the import is dropped from production).
      ...(import.meta.env.DEV
        ? [
            {
              path: '/dev/ui',
              lazy: () => import('../dev/UiGallery.jsx').then((m) => ({ Component: m.UiGallery })),
            },
          ]
        : []),
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <HouseholdsPage /> },
              { path: '/households/:householdId', element: <HouseholdPage /> },
            ],
          },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
