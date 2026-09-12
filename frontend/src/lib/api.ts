import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
let memoryAccessToken: string | null = null;
let expiringSession = false;

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `nexmart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000, // 8s — fail fast; 30s was hiding real network issues
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // critical: allows sending cookies cross-origin
});

// Cookies remain primary. The existing bearer fallback also supports OAuth;
// server-side callbacks cannot set the browser's API cookie.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers['X-Request-Id'] = createRequestId();
    if (typeof window !== 'undefined') {
      if (memoryAccessToken && !config.headers.Authorization) config.headers.Authorization = `Bearer ${memoryAccessToken}`;
      const sessionId = ensureSessionId();
      if (sessionId) {
        config.headers['x-session-id'] = sessionId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — session + error contract (CLAUDE.md §5.3)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      // Session expired/invalid at the backend. Clear auth state and send the
      // user to their role's login with a return path — never let a 401 render
      // as an empty state. Guard against redirect loops on the login endpoints.
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/');
      if (!isAuthEndpoint && !expiringSession) {
        expiringSession = true;
        const { useAuthStore } = await import('@/store/authStore');
        const role = useAuthStore.getState().user?.role || 'customer';
        useAuthStore.getState().reset();
        const { signOut } = await import('next-auth/react');
        try { await signOut({ redirect: false }); } catch { /* Still route to sign-in if session refresh fails. */ }
        const loginPath = role === 'admin' ? '/admin/login' : (role === 'agent' || role === 'delivery') ? '/delivery/login' : '/customer/login';
        const currentPath = window.location.pathname + window.location.search;
        if (!currentPath.includes('/login')) {
          window.location.href = `${loginPath}?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
    }

    return Promise.reject(error);
  }
);

// ── Helper functions ──────────────────────────────────────────
export function getApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'We couldn’t reach the store. Check your connection and try again.';
    if (error.response.status === 401) return 'Your session has expired. Sign in again to continue.';
    if (error.response.status === 429) return 'Too many requests. Wait a moment, then try again.';
    const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    // Field errors first: the backend's envelope pairs zod fieldErrors with a
    // generic "Validation error" message — the specific field message ("Enter
    // a valid 10-digit mobile number") is the actionable one.
    const firstFieldError = payload?.errors && Object.values(payload.errors).flat()[0];
    const message = firstFieldError || payload?.message;
    if (typeof message === 'string' && message.length < 350 && !/E11000|MongoServer|Cast to |ValidationError|\bat .*\.(ts|js):|[A-Z]:\\|<html/i.test(message)) return message;
    return 'The request couldn’t be completed. Refresh the information and try again.';
  }
  return 'The request couldn’t be completed. Please try again.';
}

/**
 * True when the request never got an answer — a dropped connection or timeout.
 * The write may or may not have reached the server, so callers must refetch and
 * reconcile rather than telling the user their change definitely failed.
 */
export function isUncertainError(error: unknown): boolean {
  return error instanceof AxiosError && !error.response;
}

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') memoryAccessToken = token;
}

export function clearToken(): void {
  memoryAccessToken = null;
}

export function getToken(): string | null {
  return memoryAccessToken;
}

let memorySessionId = '';
export function ensureSessionId(): string {
  if (typeof window !== 'undefined') {
    try {
      let id = localStorage.getItem('nexmart_session_id');
      if (!id) { id = memorySessionId || `guest_${createRequestId()}`; localStorage.setItem('nexmart_session_id', id); }
      memorySessionId = id;
      return id;
    } catch { memorySessionId ||= `guest_${createRequestId()}`; return memorySessionId; }
  }
  return '';
}

export default api;
