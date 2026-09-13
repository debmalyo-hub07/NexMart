import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';

// External effects are mocked at the module boundary — no network, no Redis,
// no SMTP. Rate limiters resolve "allowed" so tests are order-independent.
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

import { startTestDb, stopTestDb, clearCollections, testApp, post, get, sessionCookie } from './helpers';
import { Customer } from '../models/Customer';

let app: Application;

beforeAll(async () => {
  await startTestDb('nexmart_auth_integration');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('customer auth lifecycle', () => {
  it('registers, verifies, logs in and reaches a protected route', async () => {
    const email = 'lifecycle@test.local';
    const password = 'Passw0rdOne';

    const registered = await post(app, '/api/v1/customer/auth/register', {
      name: 'Lifecycle Customer', email, password,
    });
    expect(registered.status).toBe(201);

    const pending = await Customer.findOne({ email });
    expect(pending?.emailVerified).toBe(false);

    const verified = await post(app, '/api/v1/customer/auth/verify-otp', { email, otp: pending?.otp });
    expect(verified.status).toBe(200);

    const login = await post(app, '/api/v1/customer/auth/login', { email, password });
    expect(login.status).toBe(200);

    const profile = await get(app, '/api/v1/customer/profile', sessionCookie(login));
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);
  });

  it('refuses a protected route without a session', async () => {
    const profile = await get(app, '/api/v1/customer/profile');
    expect(profile.status).toBe(401);
  });

  it('rejects a mutating request whose Origin does not match', async () => {
    const request = (await import('supertest')).default;
    const blocked = await request(app)
      .post('/api/v1/customer/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@test.local', password: 'whatever' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CSRF_REJECTED');
  });
});
