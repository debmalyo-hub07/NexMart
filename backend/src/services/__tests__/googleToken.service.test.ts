import { describe, it, expect, vi, beforeEach } from 'vitest';

// verifyGoogleIdToken calls Google's tokeninfo endpoint. We mock global
// fetch — the response shapes below are the real Google API contract.
const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

// Mock env before import (the service reads GOOGLE_CLIENT_ID at call time,
// but keep the import clean regardless)
vi.mock('../../config/env', () => ({
  env: { GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com' },
}));

import { verifyGoogleIdToken } from '../googleToken.service';

describe('verifyGoogleIdToken (audit §3.1: never trust the request body)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns the verified identity for a valid ID token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-client-id.apps.googleusercontent.com',
        sub: '1234567890',
        email: 'real.user@gmail.com',
        email_verified: 'true',
        name: 'Real User',
        picture: 'https://lh3.googleusercontent.com/x',
      }),
    });

    const identity = await verifyGoogleIdToken('valid.jwt.token');

    expect(identity).toEqual({
      googleId: '1234567890',
      email: 'real.user@gmail.com',
      emailVerified: true,
      name: 'Real User',
      picture: 'https://lh3.googleusercontent.com/x',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/tokeninfo?id_token=valid.jwt.token'
    );
  });

  it('rejects a token issued for a different audience (our client only)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'some-other-app.apps.googleusercontent.com',
        sub: '123',
        email: 'attacker@gmail.com',
        email_verified: 'true',
      }),
    });

    await expect(verifyGoogleIdToken('stolen.jwt.token')).rejects.toThrow(/issued for this application/i);
  });

  it('rejects when the email on the Google account is not verified', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-client-id.apps.googleusercontent.com',
        sub: '123',
        email: 'unverified@gmail.com',
        email_verified: 'false',
      }),
    });

    await expect(verifyGoogleIdToken('unverified.jwt.token')).rejects.toThrow(/verified/i);
  });

  it('rejects when Google says the token is invalid (non-2xx)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });

    await expect(verifyGoogleIdToken('garbage.jwt.token')).rejects.toThrow(/invalid/i);
  });

  it('rejects when the network call fails (fail closed, never open)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(verifyGoogleIdToken('any.jwt.token')).rejects.toThrow();
  });

  it('rejects a missing/empty token without calling Google', async () => {
    await expect(verifyGoogleIdToken('')).rejects.toThrow(/token/i);
    await expect(verifyGoogleIdToken(undefined as unknown as string)).rejects.toThrow(/token/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
