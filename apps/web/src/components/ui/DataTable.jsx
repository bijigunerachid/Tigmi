import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'react-i18next';
import { Skeleton } from './Skeleton.jsx';

const ALIGN = { start: 'text-start', end: 'text-end', center: 'text-center' };

/**
 * Data table: a real <table> on wide screens and stacked cards on phones (no sideways scrolling).
 *
 * columns: [{ key, header, render?(row), align?, sortable?, mobileHidden?, primary? }]
 *   `primary` columns become the card title on phones.
 * sort: { key, direction: 'asc' | 'desc' } with onSortChange(nextSort) — sorting happens in the
 * API, not here, so pagination and sorting always agree.
 */
export function DataTable({
  caption,
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  loading = false,
  loadingRows = 4,
  empty,
}) {
  const { t } = useTranslation();
  const cell = (column, row) => (column.render ? column.render(row) : row[column.key]);
  const primary = columns.filter((column) => column.primary);
  const details = columns.filter((column) => !column.primary && !column.mobileHidden);

  const toggleSort = (column) => {
    const direction = sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange?.({ key: column.key, direction });
  };

  if (!loading && rows.length === 0 && empty) return empty;

  return (
    <div aria-busy={loading || undefined}>
      {/* Desktop and tablets */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-white/[0.03] text-ink-muted">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const ariaSort = active
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined;
                const SortIcon = !active
                  ? ChevronUpDownIcon
                  : sort.direction === 'asc'
                    ? ChevronUpIcon
                    : ChevronDownIcon;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable ? (ariaSort ?? 'none') : undefined}
                    className={`px-4 py-3 font-medium ${ALIGN[column.align ?? 'start']}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {column.header}
                        <SortIcon aria-hidden="true" className="size-4" />
                        <span className="sr-only">
                          {active && sort.direction === 'asc'
                            ? t('ui.table.sortDescending')
                            : t('ui.table.sortAscending')}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: loadingRows }, (_, i) => (
                  <tr key={`loading-${i}`}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={getRowKey(row)} className="transition-colors hover:bg-white/[0.025]">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3.5 ${ALIGN[column.align ?? 'start']}`}
                      >
                        {cell(column, row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per row */}
      <ul aria-label={caption} className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: Math.min(loadingRows, 3) }, (_, i) => (
              <li
                key={`loading-${i}`}
                className="rounded-[var(--radius-card)] border border-line p-4"
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-3 h-4 w-3/4" />
              </li>
            ))
          : rows.map((row) => (
              <li
                key={getRowKey(row)}
                className="rounded-[var(--radius-card)] border border-line bg-surface/70 p-4"
              >
                {primary.length > 0 && (
                  <div className="mb-2 font-semibold">
                    {primary.map((column) => (
                      <div key={column.key}>{cell(column, row)}</div>
                    ))}
                  </div>
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {details.map((column) => (
                    <div key={column.key} className="contents">
                      <dt className="text-ink-muted">{column.header}</dt>
                      <dd className="min-w-0 text-end">{cell(column, row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
      </ul>
    </div>
  );
}
