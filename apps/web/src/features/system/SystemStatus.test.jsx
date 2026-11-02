import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AppProviders } from '../../app/providers.jsx';
import { SystemStatus } from './SystemStatus.jsx';

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderStatus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppProviders queryClient={queryClient}>
      <SystemStatus />
    </AppProviders>,
  );
}

describe('SystemStatus', () => {
  it('shows a loading state, then API and database as connected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { status: 'ok', database: 'up' } })),
    );
    renderStatus();

    expect(screen.getByRole('status')).toHaveTextContent('Vérification en cours');
    expect(await screen.findByText('Opérationnelle')).toBeInTheDocument();
    expect(screen.getByText('Connectée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled();
    expect(fetch).toHaveBeenCalledWith('/api/v1/health', expect.any(Object));
  });

  it('shows the database as unavailable when the API answers 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(503, { data: { status: 'degraded', database: 'down' } })),
    );
    renderStatus();

    expect(await screen.findByText('Indisponible')).toBeInTheDocument();
    expect(screen.getByText('Opérationnelle')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error and recovers when the user retries', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { data: { status: 'ok', database: 'up' } }));
    vi.stubGlobal('fetch', fetchMock);
    renderStatus();

    expect(await screen.findByRole('alert')).toHaveTextContent('Injoignable');

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Connectée')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats an unexpected server error as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    renderStatus();

    expect(await screen.findByRole('alert')).toHaveTextContent('Injoignable');
  });
});
