import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/auth', () => ({ auth: (handler: unknown) => handler }));
import middleware from '@/middleware';

function visit(path: string, role?: string) {
  const request = Object.assign(new NextRequest(`https://nexmart.test${path}`), {
    auth: role ? { user: { role } } : null,
  });
  return (middleware as unknown as (req: typeof request) => NextResponse)(request);
}

describe('public seller pages and private seller portal boundaries', () => {
  it.each([undefined, 'customer'])('keeps public seller profiles open for %s', (role) => {
    const response = visit('/sellers/0123456789abcdef01234567', role);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
  it.each(['/seller', '/seller/listings', '/seller/dashboard'])('protects %s for guests', (path) => {
    expect(visit(path).headers.get('location')).toBe('https://nexmart.test/seller/login');
  });
  it('still allows signed-in sellers into their portal', () => {
    expect(visit('/seller/listings', 'seller').headers.get('x-middleware-next')).toBe('1');
  });
  it('keeps customers out of the private seller portal', () => {
    expect(visit('/seller/listings', 'customer').headers.get('location')).toBe('https://nexmart.test/');
  });
});
