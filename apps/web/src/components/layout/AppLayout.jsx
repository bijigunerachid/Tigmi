import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/AuthProvider.jsx';
import { Button } from '../ui/Button.jsx';

/** Signed-in layout: minimal top bar (the full sidebar/navigation arrives in Phase 3). */
export function AppLayout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <header className="border-b border-white/5 bg-surface/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/"
            className="rounded-lg text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span dir="ltr">
              {t('app.name')}
              <span className="text-accent">.</span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-ink-muted sm:inline">
              {t('common.signedInAs', { name: user?.fullName })}
            </span>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              loading={signingOut}
              aria-label={t('common.signOut')}
            >
              <ArrowRightStartOnRectangleIcon
                aria-hidden="true"
                className="size-5 rtl:-scale-x-100"
              />
              <span className="hidden sm:inline">{t('common.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
