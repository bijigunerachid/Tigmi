import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

/** Centered single-card layout for sign-in, sign-up and emailed-link pages. */
export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <header className="mb-8 text-center">
        <Link
          to="/"
          className="rounded-lg text-3xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span dir="ltr">
            {t('app.name')}
            <span className="text-accent">.</span>
          </span>
        </Link>
        <p className="mt-2 text-sm text-ink-muted">{t('app.tagline')}</p>
      </header>
      <main id="main" className="w-full max-w-md">
        <Outlet />
      </main>
    </div>
  );
}
