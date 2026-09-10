'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import api, { saveToken } from '@/lib/api';
import { queryRetryDelay, shouldRetryQuery } from '@/lib/queryPolicy';

function AuthSync() {
  const { data: session, status } = useSession();
  const { isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const accessToken = (session.user as { accessToken?: string }).accessToken;
      if (accessToken && (!isAuthenticated || !useAuthStore.getState().user?.name)) {
        saveToken(accessToken);
        const role = (session.user as { role?: string }).role || 'customer';
        api.get(`/${role}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } })
          .then((response) => {
            const profileData = response.data.data || {};
            setUser({
              ...profileData,
              name: profileData.name || session.user?.name || 'User',
              email: profileData.email || session.user?.email || '',
              role,
            }, accessToken);
          })
          .catch(() => { void logout(); });
      }
    } else if (status === 'unauthenticated' && isAuthenticated) {
      void logout();
    }
  }, [status, session, isAuthenticated, setUser, logout]);

  return null;
}

let globalQueryClient: QueryClient | null = null;

export function clearQueryCache() {
  globalQueryClient?.clear();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
          gcTime: 10 * 60 * 1000,
          retry: shouldRetryQuery,
          retryDelay: queryRetryDelay,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
      },
    });
    globalQueryClient = client;
    return client;
  });

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        {children}
        <Toast />
      </QueryClientProvider>
    </SessionProvider>
  );
}
