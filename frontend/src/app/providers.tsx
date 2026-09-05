'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toast } from '@/components/common/Toast';

import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import api, { saveToken, clearToken } from '@/lib/api';

function AuthSync() {
  const { data: session, status } = useSession();
  const { isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const accessToken = (session.user as any).accessToken;
      if (accessToken && (!isAuthenticated || !useAuthStore.getState().user?.name)) {
        // We have a NextAuth session but Zustand doesn't know it (e.g., after Google OAuth).
        // Save the token so API calls work, then fetch the user profile.
        saveToken(accessToken);
        const role = (session.user as any).role || 'customer';
        api.get(`/${role}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } })
          .then(res => {
            const profileData = res.data.data || {};
            // Fallback to session user data if backend profile is missing fields
            setUser({
              ...profileData,
              name: profileData.name || session.user?.name || 'Admin',
              email: profileData.email || session.user?.email || '',
              role: role,
            }, accessToken);
          })
          .catch(() => {
            // If the token is invalid, clear the session to break loops
            void logout();
          });
      }
    } else if (status === 'unauthenticated' && isAuthenticated) {
       // If NextAuth session is gone but Zustand thinks we are logged in, clear it
       void logout();
    }
  }, [status, session, isAuthenticated, setUser, logout]);

  return null;
}

let globalQueryClient: QueryClient | null = null;

export function clearQueryCache() {
  if (globalQueryClient) {
    globalQueryClient.clear();
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,          // 30s — balance freshness vs cache hits
            gcTime: 10 * 60 * 1000,        // 10min in memory — return-to-page is instant
            retry: 0,                       // fail fast, don't retry — avoids 1s+ delays
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      });
      globalQueryClient = client;
      return client;
    }
  );

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
