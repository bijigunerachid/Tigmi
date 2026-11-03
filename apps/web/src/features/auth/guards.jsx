import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.jsx';
import { safeRedirect } from '../../lib/safe-redirect.js';
import { useAuth } from './AuthProvider.jsx';

/** Pages for signed-in users. Others are sent to /login and brought back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === 'loading')
    return <LoadingSpinner label={t('common.loading')} className="min-h-dvh" />;
  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Sign-in / sign-up pages: already signed-in users go straight to where they were heading. */
export function GuestOnly() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const { t } = useTranslation();

  if (status === 'loading')
    return <LoadingSpinner label={t('common.loading')} className="min-h-dvh" />;
  if (status === 'authenticated') return <Navigate to={safeRedirect(params.get('next'))} replace />;
  return <Outlet />;
}
