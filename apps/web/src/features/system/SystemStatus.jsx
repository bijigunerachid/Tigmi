import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './health-api.js';

// French strings for now; they move into i18next (fr/ar) in Phase 3.
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

export function SystemStatus() {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth({ signal }),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <section
      aria-labelledby="system-status-title"
      className="w-full max-w-md rounded-2xl border border-white/5 bg-surface p-6 shadow-xl shadow-black/30"
    >
      <h2 id="system-status-title" className="text-lg font-semibold">
        État du système
      </h2>

      <div aria-live="polite" aria-busy={isPending} className="mt-4">
        {isPending && (
          <div role="status" className="space-y-3">
            <span className="sr-only">Vérification en cours…</span>
            <div className="h-5 animate-pulse rounded bg-white/5" />
            <div className="h-5 animate-pulse rounded bg-white/5" />
          </div>
        )}

        {isError && (
          <div role="alert" className="space-y-4">
            <dl className="divide-y divide-white/5">
              <StatusRow label="API" value="Injoignable" tone="error" />
            </dl>
            <p className="text-sm text-ink-muted">
              Le serveur ne répond pas. Vérifiez qu’il est démarré, puis réessayez.
            </p>
          </div>
        )}

        {data && (
          <dl className="divide-y divide-white/5">
            <StatusRow label="API" value="Opérationnelle" tone="ok" />
            <StatusRow
              label="Base de données"
              value={data.database === 'up' ? 'Connectée' : 'Indisponible'}
              tone={data.database === 'up' ? 'ok' : 'warn'}
            />
          </dl>
        )}
      </div>

      {!isPending && (
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? 'Vérification…' : isError ? 'Réessayer' : 'Actualiser'}
        </button>
      )}
    </section>
  );
}
