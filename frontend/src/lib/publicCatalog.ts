import 'server-only';
import { cache } from 'react';
import type { ApiResponse } from '@/types';
import { serverApiFetch } from './serverApi';
import { backendApiBase } from './apiUrl';

/** Public snapshots only: never forwards an account cookie or bearer token. */
export const publicCatalog = cache(async <T,>(path: string): Promise<ApiResponse<T> | undefined> => {
  try {
    const base = backendApiBase();
    const response = await serverApiFetch(`${base}${path}`, { publicCatalog: true, next: { revalidate: 60, tags: ['catalog'] }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) return undefined;
    const payload: ApiResponse<T> = await response.json();
    return payload.success ? payload : undefined;
  } catch { return undefined; } // The client renders a retryable query state.
});
