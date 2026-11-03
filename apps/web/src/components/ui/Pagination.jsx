import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'react-i18next';

/** Pages to show: first, last, current ±1, with gaps ("…") in between. */
export function pageItems(page, pageCount) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(`gap-${p}`);
    items.push(p);
  });
  return items;
}

const pageButton =
  'inline-grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-control)] px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

// Previous/next hold an icon AND a label side by side: flex, not grid.
const stepButton =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

/** Page navigation. On phones only previous / "page X of Y" / next are shown. */
export function Pagination({ page, pageCount, onPageChange }) {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={t('ui.pagination.label')} className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${stepButton} border border-line-strong hover:bg-white/[0.06]`}
      >
        <ChevronLeftIcon aria-hidden="true" className="size-5 rtl:-scale-x-100" />
        <span className="sr-only sm:not-sr-only">{t('ui.pagination.previous')}</span>
      </button>

      <p className="text-sm text-ink-muted sm:hidden" aria-live="polite">
        {t('ui.pagination.status', { page, pageCount })}
      </p>

      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(page, pageCount).map((item) =>
          typeof item === 'string' ? (
            <li key={item} aria-hidden="true" className="px-1 text-ink-subtle">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('ui.pagination.page', { page: item })}
                className={`${pageButton} ${item === page ? 'bg-brand text-white' : 'text-ink-muted hover:bg-white/[0.06] hover:text-ink'}`}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className={`${stepButton} border border-line-strong hover:bg-white/[0.06]`}
      >
        <span className="sr-only sm:not-sr-only">{t('ui.pagination.next')}</span>
        <ChevronRightIcon aria-hidden="true" className="size-5 rtl:-scale-x-100" />
      </button>
    </nav>
  );
}
