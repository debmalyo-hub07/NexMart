import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '@/types';
import api, { saveToken, clearToken } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Actions
  login: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User, token: string) => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user, token) => {
        saveToken(token);
        if (user?.role) {
          document.cookie = `last_role=${user.role}; path=/; max-age=31536000`;
        }
        set({ user, token, isAuthenticated: true });
      },

      reset: () => {
        clearToken();
        useCartStore.getState().reset();
        set({ user: null, token: null, isAuthenticated: false });
      },

      // role must be passed so the credentials provider hits the right backend endpoint
      login: async (email, password, role = 'customer') => {
        set({ isLoading: true });
        try {
          // Call direct login API to set the httpOnly cookie on the browser
          const endpointRole = role === 'agent' ? 'delivery' : role;
          await api.post(`/auth/${endpointRole}/login`, { email, password });

          const { signIn, getSession } = await import('next-auth/react');
          const result = await signIn('credentials', {
            email,
            password,
            role, // ← critical: tells auth.ts which /api/v1/{role}/auth/login to call
            redirect: false,
          });

          if (result?.error || !result?.ok) {
            throw new Error(result?.error || 'Invalid credentials');
          }

          const session = await getSession();
          if (session && (session as any).user?.accessToken) {
            const token = (session as any).user.accessToken;
            saveToken(token);
            const resolvedRole = (session as any).user.role || role;
            document.cookie = `last_role=${resolvedRole}; path=/; max-age=31536000`;
            
            // Set state IMMEDIATELY using session data to make login instant and prevent UI glitches
            set({
              user: {
                name: session.user?.name || 'User',
                email: session.user?.email || email,
                role: resolvedRole,
                profilePicture: session.user?.image || undefined,
              } as User,
              token,
              isAuthenticated: true,
            });

            // Fire and forget profile fetch + guest-cart merge in the background
            api.get(`/${resolvedRole}/profile`).then(({ data }) => {
              if (data?.data) {
                set((state) => ({ user: { ...state.user!, ...data.data } }));
              }
            }).catch(() => {});

            // CartSync merges the server guest cart once the session is ready.
          } else {
            throw new Error('Session not established');
          }
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const currentRole = get().user?.role || 'customer';
        try {
          // Set cookie for persistence before logging out
          document.cookie = `last_role=${currentRole}; path=/; max-age=31536000`; // 1 year
          
          const { signOut } = await import('next-auth/react');
          
          // Clear query cache
          try {
            const { clearQueryCache } = await import('@/app/providers');
            clearQueryCache();
          } catch (e) {
            console.error('Error clearing query cache:', e);
          }

          // Reset Zustand state
          get().reset();

          // Fire and forget the backend logout so it doesn't block the UI
          api.post('/auth/logout').catch(() => {});
          
          let cbUrl = '/';
          if (currentRole === 'admin') cbUrl = '/admin/login';
          if (currentRole === 'agent') cbUrl = '/delivery/login';
          
          // We clear localStorage MANUALLY instead of calling set({ user: null }).
          // This ensures that when the page reloads, the user is logged out,
          // BUT the current React UI does not tear/glitch while waiting for the redirect to happen!
          localStorage.removeItem('nexmart-auth');
          clearToken();
          
          await signOut({ callbackUrl: cbUrl });
        } catch {
          clearToken();
          get().reset();
        }
      },

      refreshUser: async () => {
        try {
          const role = get().user?.role || 'customer';
          const endpoint = role === 'agent' ? '/agent/profile' : `/${role}/profile`;
          const { data } = await api.get(endpoint);
          if (data.data) {
            set((state) => ({ user: { ...state.user!, ...data.data } }));
          }
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
          clearToken();
        }
      },

      hasRole: (role) => get().user?.role === role,
    }),
    {
      name: 'nexmart-auth',
      // NOTE: `token` is deliberately NOT persisted. The JWT lives only in the
      // HTTP-only `nexmart_*_session` cookie (sent automatically via withCredentials).
      // Persisting it to localStorage would expose it to XSS. It is kept in-memory
      // only for the current tab session (used for the Bearer fallback in providers.tsx).
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
