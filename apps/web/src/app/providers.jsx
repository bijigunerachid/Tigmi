import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: true },
    },
  });
}

export function AppProviders({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
