import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../features/auth/AuthProvider.jsx';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Client errors (403, 404…) will not change by retrying; only retry server/network errors.
        retry: (failureCount, error) =>
          failureCount < 2 && (error?.status === 0 || error?.status >= 500),
      },
    },
  });
}

/** Server-state cache and session, shared by every page. */
export function AppProviders({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
