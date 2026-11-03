import { CheckIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { BrandLockup } from '../brand/BrandMark.jsx';
import { HeroHouse } from '../illustrations/HeroHouse.jsx';
import { IsoHouse } from '../illustrations/IsoHouse.jsx';
import { LanguageSwitcher } from '../shared/LanguageSwitcher.jsx';

/**
 * Layout for sign-in, sign-up and emailed-link pages.
 * Desktop: brand panel (ambient light + what Tigmi offers today) beside the form.
 * Phone: compact brand header above the form. The language switch is always reachable.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const points = ['point1', 'point2', 'point3'];

  return (
    <div className="relative min-h-dvh overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* Brand panel — desktop only */}
      <aside className="relative hidden h-dvh flex-col gap-6 border-e border-line p-10 lg:sticky lg:top-0 lg:flex xl:p-14">
        <Link
          to="/"
          aria-label={t('app.markLabel')}
          className="w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <BrandLockup size="lg" />
        </Link>
        {/* The one bold element of the product: the home itself, in 3D. */}
        <HeroHouse className="-mx-6 min-h-0 flex-1" />
        <div className="stagger max-w-lg">
          <p
            style={{ '--i': 0 }}
            className="text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl"
          >
            {t('auth.brand.headline')}
          </p>
          <p
            style={{ '--i': 1 }}
            className="mt-3 text-base leading-relaxed text-ink-muted xl:text-lg"
          >
            {t('auth.brand.body')}
          </p>
          <ul style={{ '--i': 2 }} className="mt-6 space-y-2.5 text-sm xl:text-base">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-ink/90">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 ring-1 ring-accent/30">
                  <CheckIcon aria-hidden="true" className="size-4 text-accent" />
                </span>
                {t(`auth.brand.${point}`)}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form side */}
      <div className="relative flex min-h-dvh flex-col px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label={t('app.markLabel')}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:invisible"
          >
            <BrandLockup />
          </Link>
          <LanguageSwitcher />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md animate-rise-in">
            {/* Phones and tablets: the home, drawn in code (the desktop panel shows it in 3D). */}
            <IsoHouse className="mx-auto -mt-4 mb-4 h-36 w-auto lg:hidden" />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
