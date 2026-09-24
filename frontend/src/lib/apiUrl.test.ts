import { describe, expect, it } from 'vitest';
import { backendApiBase, safeReturnPath } from './apiUrl';

describe('deployment URLs and return paths', () => {
  it('accepts both documented Render URL formats without doubling the API path', () => {
    expect(backendApiBase('https://example.onrender.com')).toBe('https://example.onrender.com/api/v1');
    expect(backendApiBase('https://example.onrender.com/api/v1/')).toBe('https://example.onrender.com/api/v1');
  });
  it('preserves a customer checkout return path', () => {
    expect(safeReturnPath('/checkout?step=payment', '/')).toBe('/checkout?step=payment');
  });
  it('rejects external, encoded, backslash and sign-in loop redirects', () => {
    for (const path of ['https://evil.test', '//evil.test', '/%2fevil.test', '/\\evil.test', '/%5cevil.test', '/customer/login', '/%0aevil']) {
      expect(safeReturnPath(path, '/')).toBe('/');
    }
  });
});
