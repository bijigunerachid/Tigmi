import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { fetchHealth } from './health-api.js';

const TONES = {
  ok: { dot: 'bg-success', text: 'text-success' },
  warn: { dot: 'bg-warning', text: 'text-warning' },
  error: { dot: 'bg-danger', text: 'text-danger' },
};

function StatusRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`flex items-center gap-2 font-medium ${TONES[tone].text}`}>
        <span aria-hidden="true" className={`size-2 rounded-full ${TONES[tone].dot}`} />
        {value}
      </dd>
    </div>
  );
}

/** Public page showing whether the API and database are reachable (useful for support). */
export function SystemStatus() {
  const { t } = useTranslation();
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth({ signal }),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <Card as="section" aria-labelledby="system-status-title" className="w-full">
      <h1 id="system-status-title" className="text-lg font-semibold">
        {t('status.title')}
      </h1>

      <div aria-live="polite" aria-busy={isPending} className="mt-4">
        {isPending && (
          <div role="status" className="space-y-3">
            <span className="sr-only">{t('status.checking')}</span>
            <div className="h-5 animate-pulse rounded bg-white/5" />
            <div className="h-5 animate-pulse rounded bg-white/5" />
          </div>
        )}

        {isError && (
          <div role="alert" className="space-y-4">
            <dl className="divide-y divide-white/5">
              <StatusRow label={t('status.api')} value={t('status.unreachable')} tone="error" />
            </dl>
            <p className="text-sm text-ink-muted">{t('status.unreachableHelp')}</p>
          </div>
        )}

        {data && (
          <dl className="divide-y divide-white/5">
            <StatusRow label={t('status.api')} value={t('status.operational')} tone="ok" />
            <StatusRow
              label={t('status.database')}
              value={data.database === 'up' ? t('status.connected') : t('status.unavailable')}
              tone={data.database === 'up' ? 'ok' : 'warn'}
            />
          </dl>
        )}
      </div>

      {!isPending && (
        <Button className="mt-6 w-full" onClick={() => refetch()} disabled={isFetching}>
          {isFetching
            ? t('status.checkingShort')
            : isError
              ? t('common.retry')
              : t('status.refresh')}
        </Button>
      )}
    </Card>
  );
}
