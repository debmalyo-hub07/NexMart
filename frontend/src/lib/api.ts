import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000, // 8s — fail fast; 30s was hiding real network issues
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('nexmart_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const sessionId = localStorage.getItem('nexmart_session_id');
      if (sessionId) {
        config.headers['x-session-id'] = sessionId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nexmart_token');
        // We let middleware handle redirects for protected routes.
        // Doing window.location.href here causes race condition loops with NextAuth.
      }
    }
    return Promise.reject(error);
  }
);

// ── Helper functions ──────────────────────────────────────────
export function getApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
}

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexmart_token', token);
  }
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nexmart_token');
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('nexmart_token');
  }
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
