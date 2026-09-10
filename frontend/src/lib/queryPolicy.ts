import { isAxiosError } from 'axios';

const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 409, 422]);

function responseStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = responseStatus(error);
  if (status !== undefined && NON_RETRYABLE_STATUS.has(status)) return false;
  if (status === 429) return failureCount < 1;
  if (status !== undefined) return status >= 500 && failureCount < 2;
  // A missing response is normally a timeout, cancellation, or network loss.
  // Queries are safe to retry twice; mutations opt in separately.
  return failureCount < 2;
}

export function queryRetryDelay(attemptIndex: number, error: unknown): number {
  if (isAxiosError(error)) {
    const retryAfter = error.response?.headers?.['retry-after'];
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  }
  return Math.min(1000 * 2 ** attemptIndex, 8_000);
}
