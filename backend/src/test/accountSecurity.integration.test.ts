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
  send: vi.fn(async (_options: { to: string; subject: string; html: string }) => undefined),
}));
vi.mock('../services/email.service', () => ({
  sendEmail: mailer.send,
  buildOtpEmail: vi.fn(() => '<p>otp</p>'),
  buildResetEmail: vi.fn((_name: string, code: string) => `<p>reset ${code}</p>`),
  buildGoogleOnlyResetEmail: vi.fn(() => '<p>use google</p>'),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));
vi.mock('../services/googleToken.service', () => ({ verifyGoogleIdToken: vi.fn() }));

import { startTestDb, stopTestDb, clearCollections, testApp, post, put, get, registerAndVerify, sessionCookie } from './helpers';
import { Customer } from '../models/Customer';
import { verifyGoogleIdToken } from '../services/googleToken.service';

let app: Application;
const PASSWORD = 'Passw0rdOne';

function readMailCode(email: string): string {
  const call = mailer.send.mock.calls.at(-1)?.[0];
  if (!call || call.to !== email) throw new Error(`No mail sent to ${email}`);
  const match = call.html.match(/\d{6}/);
  if (!match) throw new Error('No six-digit code in the mail');
  return match[0];
}

/** A Google-only customer plus a session cookie, minted the way the Google path does. */
async function googleCustomer(email: string): Promise<string> {
  await Customer.create({
    name: 'Google Only', email, googleId: `g-${email}`,
    emailVerified: true, isActive: true, authProviders: ['google'],
  });
  const customer = await Customer.findOne({ email });
  const { generateToken } = await import('../middleware/auth');
  const { env } = await import('../config/env');
  const token = generateToken({ id: customer!._id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '7d');
  return `nexmart_customer_session=${token}`;
}

beforeAll(async () => {
  await startTestDb('nexmart_account_security');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); vi.clearAllMocks(); });

describe('set-password for a Google-only account', () => {
  it('adds a password after an emailed code and records the provider', async () => {
    const cookie = await googleCustomer('setpw@test.local');

    const requested = await post(app, '/api/v1/customer/set-password/request', {}, cookie);
    expect(requested.status).toBe(202);
    const code = readMailCode('setpw@test.local');

    const res = await post(app, '/api/v1/customer/set-password', { otp: code, password: PASSWORD }, cookie);
    expect(res.status).toBe(200);

    const updated = await Customer.findOne({ email: 'setpw@test.local' });
    expect(updated?.authProviders).toContain('email');
    expect(updated?.authProviders).toContain('google');

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'setpw@test.local', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('refuses when the account already has a password', async () => {
    const { cookie } = await registerAndVerify(app, 'haspw@test.local', PASSWORD);
    const res = await post(app, '/api/v1/customer/set-password/request', {}, cookie);
    expect(res.status).toBe(409);
  });

  it('refuses a wrong code', async () => {
    const cookie = await googleCustomer('wrongcode@test.local');
    await post(app, '/api/v1/customer/set-password/request', {}, cookie);

    const res = await post(app, '/api/v1/customer/set-password', { otp: '000000', password: PASSWORD }, cookie);
    expect(res.status).toBe(400);

    const stored = await Customer.findOne({ email: 'wrongcode@test.local' });
    expect(stored?.password).toBeUndefined();
  });
});

describe('sign out everywhere', () => {
  it('invalidates the calling session and every other one', async () => {
    const { cookie } = await registerAndVerify(app, 'signout@test.local', PASSWORD);
    const second = await post(app, '/api/v1/customer/auth/login', { email: 'signout@test.local', password: PASSWORD });
    const secondCookie = sessionCookie(second);

    const res = await post(app, '/api/v1/customer/sign-out-everywhere', {}, cookie);
    expect(res.status).toBe(200);

    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(401);
    expect((await get(app, '/api/v1/customer/profile', secondCookie)).status).toBe(401);
  });
});

describe('profile update validation', () => {
  it('rejects a bad phone with the codebase-standard validation envelope', async () => {
    const { cookie } = await registerAndVerify(app, 'profile@test.local', PASSWORD);
    const bad = await put(app, '/api/v1/customer/profile', { name: 'Fine', phone: '12345' }, cookie);
    // 422 + VALIDATION_ERROR + field errors is what the global error handler
    // returns for every ZodError; getApiError surfaces errors.phone[0].
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
    expect(bad.body.errors.phone[0]).toBe('Enter a valid 10-digit Indian mobile number');
  });

  it('never lets role or isActive ride in on a profile update', async () => {
    const { cookie, customerId } = await registerAndVerify(app, 'sneaky@test.local', PASSWORD);

    await put(app, '/api/v1/customer/profile', { name: 'Fine', role: 'admin', isActive: false }, cookie);

    const stored = await Customer.findById(customerId);
    expect(stored?.role).toBe('customer');
    expect(stored?.isActive).toBe(true);
  });

  it('accepts a valid update', async () => {
    const { cookie, customerId } = await registerAndVerify(app, 'goodupdate@test.local', PASSWORD);
    const res = await put(app, '/api/v1/customer/profile', { name: 'New Name', phone: '9876543210' }, cookie);
    expect(res.status).toBe(200);

    const stored = await Customer.findById(customerId);
    expect(stored?.name).toBe('New Name');
    expect(stored?.phone).toBe('9876543210');
  });
});

describe('google linking records the provider', () => {
  it('adds google to authProviders when linking an existing email account', async () => {
    await registerAndVerify(app, 'linkme@test.local', PASSWORD);
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      googleId: 'g-link', email: 'linkme@test.local', name: 'Link Me', picture: '', emailVerified: true,
    });

    const res = await post(app, '/api/v1/auth/google/callback', { idToken: 'stub' });
    expect(res.status).toBe(200);

    const stored = await Customer.findOne({ email: 'linkme@test.local' });
    expect(stored?.authProviders).toEqual(expect.arrayContaining(['email', 'google']));
  });
});
