import { describe, expect, it } from 'vitest';
import axios from 'axios';
import { queryRetryDelay, shouldRetryQuery } from './queryPolicy';

function errorWithStatus(status: number) {
  return new axios.AxiosError(`status ${status}`, undefined, undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new axios.AxiosHeaders() },
    data: {},
  });
}

describe('query retry policy', () => {
  it('does not retry client or authorization errors', () => {
    expect(shouldRetryQuery(0, errorWithStatus(400))).toBe(false);
    expect(shouldRetryQuery(0, errorWithStatus(401))).toBe(false);
    expect(shouldRetryQuery(0, errorWithStatus(404))).toBe(false);
    expect(shouldRetryQuery(0, errorWithStatus(409))).toBe(false);
  });

  it('bounds transient server and network retries', () => {
    expect(shouldRetryQuery(0, errorWithStatus(503))).toBe(true);
    expect(shouldRetryQuery(2, errorWithStatus(503))).toBe(false);
    expect(shouldRetryQuery(0, new Error('offline'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('offline'))).toBe(false);
  });

  it('honors a bounded Retry-After response', () => {
    const error = errorWithStatus(429);
    if (axios.isAxiosError(error) && error.response) error.response.headers['retry-after'] = '3';
    expect(queryRetryDelay(0, error)).toBe(3000);
    expect(queryRetryDelay(4, new Error('offline'))).toBe(8000);
  });
});
