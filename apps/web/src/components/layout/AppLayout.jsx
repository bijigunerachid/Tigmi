import {
  ArrowRightStartOnRectangleIcon,
  ChevronDoubleLeftIcon,
  HomeModernIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/AuthProvider.jsx';
import { householdKeys, listHouseholds } from '../../features/households/households-api.js';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../lib/i18n.js';
import { BrandLockup } from '../brand/BrandMark.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

const SIDEBAR_KEY = 'tigmi.sidebar';
const LAST_HOUSEHOLD_KEY = 'tigmi.lastHousehold';

const readStored = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // preference only lasts for this visit
  }
};

/** Account menu: language (functional, saved) and sign out. */
function AccountMenu({ align = 'end', side = 'bottom', compact = false }) {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const items = [
    ...SUPPORTED_LANGUAGES.map((language) => ({
      id: `lang-${language}`,
      label: t(`language.${language}`),
      lang: language,
      checked: i18n.resolvedLanguage === language,
      onSelect: () => setLanguage(language),
    })),
    {
      id: 'sign-out',
      label: t('common.signOut'),
      icon: ArrowRightStartOnRectangleIcon,
      tone: 'danger',
      onSelect: async () => {
        await signOut();
        navigate('/login', { replace: true });
      },
    },
  ];

  return (
    <Dropdown
      label={t('nav.account')}
      align={align}
      side={side}
      fullWidth={!compact}
      items={items}
      triggerProps={{
        variant: 'ghost',
        className: compact ? 'size-11 p-0' : 'w-full justify-start px-2 py-2 h-auto',
      }}
      triggerContent={
        <>
          <Avatar name={user?.fullName} seed={user?.id} size="sm" />
          {!compact && (
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-sm font-medium text-ink">{user?.fullName}</span>
              <span className="block truncate text-xs text-ink-subtle">
                <bdi>{user?.email}</bdi>
              </span>
            </span>
          )}
        </>
      }
    />
  );
}

const navItemClass = ({ isActive }) =>
  `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
    isActive
      ? 'bg-white/[0.07] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
      : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink'
  }`;

/**
 * Signed-in layout.
 * Desktop: collapsible sidebar (choice remembered) with your households and the account menu.
 * Phone: frosted top bar (brand + account) and bottom bar (households, last household).
 * Every destination is a real page: no placeholder links.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => readStored(SIDEBAR_KEY) === 'collapsed');
  const householdMatch = useMatch('/households/:householdId');
  const currentId = householdMatch?.params.householdId;
  const households = useQuery({ queryKey: householdKeys.all, queryFn: listHouseholds });

  // Remember the last opened household for the phone bottom bar.
  useEffect(() => {
    if (currentId) writeStored(LAST_HOUSEHOLD_KEY, currentId);
  }, [currentId]);
  const lastId = currentId ?? readStored(LAST_HOUSEHOLD_KEY);
  const lastHousehold = households.data?.find((household) => household.id === lastId);

  const toggleSidebar = () => {
    setCollapsed((value) => {
      writeStored(SIDEBAR_KEY, value ? 'expanded' : 'collapsed');
      return !value;
    });
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={`vt-nav glass fixed inset-y-0 start-0 z-[var(--z-header)] hidden flex-col border-e border-line transition-[width] duration-200 ease-[var(--ease-out)] lg:flex ${collapsed ? 'w-[4.75rem]' : 'w-64'}`}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-3.5">
          <Link
            to="/"
            viewTransition
            aria-label={t('app.markLabel')}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent"
          >
            <BrandLockup showWordmark={!collapsed} />
          </Link>
        </div>

        <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto px-3 py-2">
          <NavLink
            to="/"
            end
            viewTransition
            className={navItemClass}
            title={collapsed ? t('nav.households') : undefined}
          >
            <Squares2X2Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={collapsed ? 'sr-only' : ''}>{t('nav.households')}</span>
          </NavLink>

          {households.data?.length > 0 && (
            <div className="mt-6">
              <p
                className={`mb-2 px-3 text-xs font-medium text-ink-subtle ${collapsed ? 'sr-only' : ''}`}
              >
                {t('nav.householdsSection')}
              </p>
              <ul className="space-y-1">
                {households.data.map((household) => (
                  <li key={household.id}>
                    <NavLink
                      to={`/households/${household.id}`}
                      viewTransition
                      className={navItemClass}
                      title={collapsed ? household.name : undefined}
                    >
                      <Avatar
                        name={household.name}
                        seed={household.id}
                        size="sm"
                        className="-ms-1"
                      />
                      <span className={`truncate ${collapsed ? 'sr-only' : ''}`}>
                        {household.name}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="space-y-1 border-t border-line p-3">
          <AccountMenu align="start" side="top" compact={collapsed} />
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-ink-subtle transition-colors hover:bg-white/[0.04] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronDoubleLeftIcon
              aria-hidden="true"
              className={`size-5 shrink-0 transition-transform duration-200 rtl:-scale-x-100 ${collapsed ? 'rotate-180' : ''}`}
            />
            <span className={collapsed ? 'sr-only' : ''}>
              {collapsed ? t('nav.expand') : t('nav.collapse')}
            </span>
          </button>
        </div>
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="vt-nav glass sticky top-0 z-[var(--z-header)] flex h-16 items-center justify-between border-b border-line px-4 lg:hidden">
        <Link
          to="/"
          viewTransition
          aria-label={t('app.markLabel')}
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent"
        >
          <BrandLockup />
        </Link>
        <AccountMenu compact />
      </header>

      <main
        id="main"
        className={`mx-auto max-w-6xl px-4 pt-6 pb-28 transition-[padding] duration-200 sm:px-6 lg:pt-10 lg:pb-12 ${collapsed ? 'lg:ps-[calc(4.75rem+2rem)]' : 'lg:ps-[calc(16rem+2rem)]'} lg:max-w-none lg:pe-8`}
      >
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* ---------- Phone bottom bar ---------- */}
      <nav
        aria-label={t('nav.main')}
        className="glass fixed inset-x-3 bottom-3 z-[var(--z-header)] flex items-center gap-1 rounded-2xl border border-line p-1.5 shadow-[var(--shadow-raised)] lg:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink
          to="/"
          end
          viewTransition
          className={({ isActive }) => `${navItemClass({ isActive })} flex-1 justify-center`}
        >
          <Squares2X2Icon aria-hidden="true" className="size-5" />
          {t('nav.households')}
        </NavLink>
        {lastHousehold && (
          <NavLink
            to={`/households/${lastHousehold.id}`}
            viewTransition
            className={({ isActive }) =>
              `${navItemClass({ isActive })} min-w-0 flex-1 justify-center`
            }
          >
            <HomeModernIcon aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate">{lastHousehold.name}</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
