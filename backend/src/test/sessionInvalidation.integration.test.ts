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
vi.mock('../services/email.service', () => ({
  sendEmail: vi.fn(async () => undefined),
  buildOtpEmail: vi.fn(() => '<p>otp</p>'),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));

import { startTestDb, stopTestDb, clearCollections, testApp, get, registerAndVerify } from './helpers';
import { Customer } from '../models/Customer';

let app: Application;

beforeAll(async () => {
  await startTestDb('nexmart_session_invalidation');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('credentialsChangedAt invalidates prior sessions', () => {
  it('rejects a session issued before credentials changed', async () => {
    const { cookie, customerId } = await registerAndVerify(app, 'invalidate@test.local', 'Passw0rdOne');

    const before = await get(app, '/api/v1/customer/profile', cookie);
    expect(before.status).toBe(200);

    // Stamp one second into the future: JWT `iat` has whole-second resolution,
    // so a same-second stamp would not reliably compare as "after".
    await Customer.findByIdAndUpdate(customerId, { credentialsChangedAt: new Date(Date.now() + 1000) });

    const after = await get(app, '/api/v1/customer/profile', cookie);
    expect(after.status).toBe(401);
  });

  it('leaves sessions issued after the change working', async () => {
    const { customerId } = await registerAndVerify(app, 'stillvalid@test.local', 'Passw0rdOne');
    await Customer.findByIdAndUpdate(customerId, { credentialsChangedAt: new Date(Date.now() - 60_000) });

    const fresh = await registerAndVerify(app, 'stillvalid2@test.local', 'Passw0rdOne');
    const profile = await get(app, '/api/v1/customer/profile', fresh.cookie);
    expect(profile.status).toBe(200);
  });
});
