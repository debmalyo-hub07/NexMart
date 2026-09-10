import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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

// Request interceptor — attach session ID only (token is sent via HTTP-only cookie)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers['X-Request-Id'] = createRequestId();
    if (typeof window !== 'undefined') {
      const sessionId = localStorage.getItem('nexmart_session_id');
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
      if (!isAuthEndpoint) {
        const { useAuthStore } = await import('@/store/authStore');
        const role = useAuthStore.getState().user?.role || 'customer';
        useAuthStore.getState().reset();
        const loginPath = role === 'admin' ? '/admin/login' : (role === 'agent' || role === 'delivery') ? '/delivery/login' : '/customer/login';
        const currentPath = window.location.pathname;
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
    const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    // Field errors first: the backend's envelope pairs zod fieldErrors with a
    // generic "Validation error" message — the specific field message ("Enter
    // a valid 10-digit mobile number") is the actionable one.
    const firstFieldError = payload?.errors && Object.values(payload.errors).flat()[0];
    if (firstFieldError) return firstFieldError;
    if (payload?.message) return payload.message;
    return error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
}

export function saveToken(token: string): void {
  // no-op: JWT tokens must live exclusively in HTTP-only cookies
}

export function clearToken(): void {
  // no-op: JWT tokens must live exclusively in HTTP-only cookies
}

export function getToken(): string | null {
  return null;
}

export function ensureSessionId(): string {
  if (typeof window !== 'undefined') {
    let id = localStorage.getItem('nexmart_session_id');
    if (!id) {
      id = `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('nexmart_session_id', id);
    }
    return id;
  }
  return '';
}

export default api;
