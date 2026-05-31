// apps/mobile/src/lib/queryClient.ts
// React Query client configuration

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 2 minutes — avoids unnecessary refetches
      staleTime: 2 * 60 * 1000,
      // Keep unused cached data for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed queries twice with exponential backoff
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // Don't refetch on window focus in mobile (irrelevant)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
