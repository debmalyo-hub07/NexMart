import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';

vi.mock('../config/redis', () => ({
  otpEmailRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  getFailedLoginAttempts: vi.fn(async () => 0),
  incrementFailedLoginAttempts: vi.fn(async () => 1),
  clearFailedLoginAttempts: vi.fn(async () => undefined),
  blacklistToken: vi.fn(async () => undefined),
  isTokenBlacklisted: vi.fn(async () => false),
  generalRateLimiter: { limit: vi.fn(async () => ({ success: true, remaining: 99, reset: 0 })) },
  authRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  otpRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  registrationRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  paymentRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  upstashRedis: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), del: vi.fn(async () => undefined) },
}));

const mailer = vi.hoisted(() => ({
  // Typed with the real argument shape: an untyped `vi.fn(async () => …)`
  // infers a zero-arg signature, so `.mock.calls[0][0]` would not typecheck.
  send: vi.fn(async (_options: { to: string; subject: string; html: string }) => undefined),
}));
vi.mock('../services/email.service', () => ({
  sendEmail: mailer.send,
  buildOtpEmail: vi.fn(() => '<p>otp</p>'),
  buildResetEmail: vi.fn((_name: string, code: string) => `<p>reset ${code}</p>`),
  buildGoogleOnlyResetEmail: vi.fn(() => '<p>use google</p>'),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));

import { startTestDb, stopTestDb, clearCollections, testApp, post, get, registerAndVerify, sessionCookie } from './helpers';
import { Customer } from '../models/Customer';
import { hashResetCode } from '../utils/resetCode';

let app: Application;
const PASSWORD = 'Passw0rdOne';
const NEXT_PASSWORD = 'Passw0rdTwo';

async function readResetCode(email: string): Promise<string> {
  // The code itself is never stored, so tests read it from the mocked mail.
  const call = mailer.send.mock.calls.at(-1)?.[0];
  if (!call || call.to !== email) throw new Error(`No mail sent to ${email}`);
  const match = call.html.match(/\d{6}/);
  if (!match) throw new Error('No six-digit code in the reset mail');
  return match[0];
}

beforeAll(async () => {
  await startTestDb('nexmart_password_reset');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); vi.clearAllMocks(); });

describe('forgot-password is opaque', () => {
  it('answers identically for a real account and an unknown address', async () => {
    await registerAndVerify(app, 'real@test.local', PASSWORD);

    const known = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'real@test.local' });
    const unknown = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'nobody@test.local' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  it('sends a Google-sign-in mail, never a code, for a Google-only account', async () => {
    await Customer.create({
      name: 'Google Only', email: 'googler@test.local', googleId: 'g-123',
      emailVerified: true, isActive: true, authProviders: ['google'],
    });

    const res = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'googler@test.local' });
    expect(res.status).toBe(202);

    const sent = mailer.send.mock.calls.at(-1)?.[0];
    expect(sent?.to).toBe('googler@test.local');
    expect(sent?.html).not.toMatch(/\d{6}/);

    const stored = await Customer.findOne({ email: 'googler@test.local' }).select('+resetOtpHash');
    expect(stored?.resetOtpHash).toBeUndefined();
  });

  it('stores the code hashed, never in plaintext', async () => {
    await registerAndVerify(app, 'hashed@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'hashed@test.local' });

    const code = await readResetCode('hashed@test.local');
    const stored = await Customer.findOne({ email: 'hashed@test.local' }).select('+resetOtpHash');
    expect(stored?.resetOtpHash).toBe(hashResetCode(code));
    expect(stored?.resetOtpHash).not.toBe(code);
  });
});

describe('reset-password', () => {
  it('resets the password, kills the old session, and accepts the new one', async () => {
    const { cookie } = await registerAndVerify(app, 'reset@test.local', PASSWORD);
    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(200);

    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'reset@test.local' });
    const code = await readResetCode('reset@test.local');

    const reset = await post(app, '/api/v1/customer/auth/reset-password', {
      email: 'reset@test.local', otp: code, password: NEXT_PASSWORD,
    });
    expect(reset.status).toBe(200);

    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(401);
    expect((await post(app, '/api/v1/customer/auth/login', { email: 'reset@test.local', password: PASSWORD })).status).toBe(401);

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'reset@test.local', password: NEXT_PASSWORD });
    expect(login.status).toBe(200);
    expect((await get(app, '/api/v1/customer/profile', sessionCookie(login))).status).toBe(200);
  });

  it('answers a wrong code, an unknown email and an expired code identically', async () => {
    await registerAndVerify(app, 'uniform@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'uniform@test.local' });
    const code = await readResetCode('uniform@test.local');

    const wrong = await post(app, '/api/v1/customer/auth/reset-password', { email: 'uniform@test.local', otp: '000000', password: NEXT_PASSWORD });
    const absent = await post(app, '/api/v1/customer/auth/reset-password', { email: 'nobody@test.local', otp: '000000', password: NEXT_PASSWORD });

    await Customer.findOneAndUpdate({ email: 'uniform@test.local' }, { resetOtpExpiry: new Date(Date.now() - 1000) });
    const expired = await post(app, '/api/v1/customer/auth/reset-password', { email: 'uniform@test.local', otp: code, password: NEXT_PASSWORD });

    expect(wrong.status).toBe(400);
    expect(absent.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(wrong.body).toEqual(absent.body);
    expect(expired.body).toEqual(absent.body);
  });

  it('kills the code after five wrong attempts', async () => {
    await registerAndVerify(app, 'attempts@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'attempts@test.local' });
    const code = await readResetCode('attempts@test.local');

    for (let i = 0; i < 5; i += 1) {
      await post(app, '/api/v1/customer/auth/reset-password', { email: 'attempts@test.local', otp: '000000', password: NEXT_PASSWORD });
    }

    // The sixth try uses the CORRECT code and must still fail.
    const afterBurn = await post(app, '/api/v1/customer/auth/reset-password', { email: 'attempts@test.local', otp: code, password: NEXT_PASSWORD });
    expect(afterBurn.status).toBe(400);

    expect((await post(app, '/api/v1/customer/auth/login', { email: 'attempts@test.local', password: NEXT_PASSWORD })).status).toBe(401);
  });

  it('refuses to reuse a code after a successful reset', async () => {
    await registerAndVerify(app, 'reuse@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'reuse@test.local' });
    const code = await readResetCode('reuse@test.local');

    expect((await post(app, '/api/v1/customer/auth/reset-password', { email: 'reuse@test.local', otp: code, password: NEXT_PASSWORD })).status).toBe(200);
    expect((await post(app, '/api/v1/customer/auth/reset-password', { email: 'reuse@test.local', otp: code, password: 'Passw0rdThree' })).status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    await registerAndVerify(app, 'weak@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'weak@test.local' });
    const code = await readResetCode('weak@test.local');

    const res = await post(app, '/api/v1/customer/auth/reset-password', { email: 'weak@test.local', otp: code, password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('unverified login does not feed the lockout counter', () => {
  it('leaves the failed-attempt counter untouched for a correct password', async () => {
    const redis = await import('../config/redis');
    await post(app, '/api/v1/customer/auth/register', { name: 'Unverified', email: 'unverified@test.local', password: PASSWORD });
    vi.mocked(redis.incrementFailedLoginAttempts).mockClear();

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'unverified@test.local', password: PASSWORD });
    expect(login.status).toBe(403);
    expect(redis.incrementFailedLoginAttempts).not.toHaveBeenCalled();
  });

  it('still counts a genuinely wrong password', async () => {
    const redis = await import('../config/redis');
    await registerAndVerify(app, 'wrongpw@test.local', PASSWORD);
    vi.mocked(redis.incrementFailedLoginAttempts).mockClear();

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'wrongpw@test.local', password: 'Wr0ngPassword' });
    expect(login.status).toBe(401);
    expect(redis.incrementFailedLoginAttempts).toHaveBeenCalled();
  });
});
