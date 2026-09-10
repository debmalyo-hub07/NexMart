import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, isTrustedRequestOrigin } from '../origin';

describe('request origin validation', () => {
  it('matches exact origins, including a referer with a path', () => {
    expect(isAllowedOrigin('https://shop.example/account', 'https://shop.example')).toBe(true);
    expect(isTrustedRequestOrigin(undefined, 'https://shop.example/cart', 'https://shop.example')).toBe(true);
  });

  it('rejects lookalike hosts and malformed URLs', () => {
    expect(isAllowedOrigin('https://shop.example.evil/cart', 'https://shop.example')).toBe(false);
    expect(isAllowedOrigin('not-a-url', 'https://shop.example')).toBe(false);
  });

  it('requires a trusted origin or referer', () => {
    expect(isTrustedRequestOrigin(undefined, undefined, 'https://shop.example')).toBe(false);
    expect(isTrustedRequestOrigin('https://evil.example', 'https://shop.example.evil', 'https://shop.example')).toBe(false);
  });
});
