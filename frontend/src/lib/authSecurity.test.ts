import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextAuthConfig } from 'next-auth';

const captured = vi.hoisted(() => ({ config: {} as NextAuthConfig, backend: vi.fn() }));
vi.mock('next-auth', () => ({ default: (config: NextAuthConfig) => { captured.config = config; return {}; } }));
vi.mock('@/lib/serverApi', () => ({ serverApiFetch: captured.backend }));
import '@/auth';

type JwtArgs = Parameters<NonNullable<NonNullable<NextAuthConfig['callbacks']>['jwt']>>[0];
type SignInArgs = Parameters<NonNullable<NonNullable<NextAuthConfig['callbacks']>['signIn']>>[0];

beforeEach(() => captured.backend.mockReset());
describe('frontend identity is always server-authoritative', () => {
  it('ignores role escalation through a client session update', async () => {
    const token = { sub: 'customer-1', role: 'customer', accessToken: 'original-token' };
    const result = await captured.config.callbacks!.jwt!({ token, trigger: 'update', session: { role: 'admin' } } as unknown as JwtArgs);
    expect(result).toMatchObject({ sub: 'customer-1', role: 'customer', accessToken: 'original-token' });
  });

  it('refuses Google sign-in when the backend rejects the account', async () => {
    captured.backend.mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Account suspended' }), { status: 403 }));
    const result = await captured.config.callbacks!.signIn!({ user: { id: 'google-id' }, account: { provider: 'google', id_token: 'google-id-token' } } as SignInArgs);
    expect(result).toBe(false);
  });
});
