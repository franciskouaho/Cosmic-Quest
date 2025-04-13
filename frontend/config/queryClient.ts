import { QueryClient } from '@tanstack/react-query';

// Configuration du client React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (anciennement cacheTime)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
