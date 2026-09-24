import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const security = vi.hoisted(() => ({ revoked: new Set<string>(), blacklist: vi.fn() }));
vi.mock('../config/redis', () => ({
  otpEmailRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  getFailedLoginAttempts: vi.fn(async () => 0), incrementFailedLoginAttempts: vi.fn(async () => 1), clearFailedLoginAttempts: vi.fn(),
  blacklistToken: async (jti: string) => { security.blacklist(jti); security.revoked.add(jti); },
  isTokenBlacklisted: async (jti: string) => security.revoked.has(jti),
  generalRateLimiter: { limit: vi.fn(async () => ({ success: true, remaining: 99, reset: Date.now() + 60000 })) },
  authRateLimiter: { limit: vi.fn(async () => ({ success: true })) }, otpRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  registrationRateLimiter: { limit: vi.fn(async () => ({ success: true })) }, paymentRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  upstashRedis: { get: vi.fn(async () => null), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../services/email.service', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn(), sendOrderStatusEmail: vi.fn() }));

import { startTestDb, stopTestDb, clearCollections, testApp, TEST_ORIGIN } from './helpers';
import { Customer } from '../models/Customer';
import { generateToken, optionalCustomerAuth } from '../middleware/auth';
import { env } from '../config/env';
import { hashResetCode } from '../utils/resetCode';

beforeAll(() => startTestDb('nexmart_security_boundaries'), 120000);
afterAll(stopTestDb);
beforeEach(async () => { await clearCollections(); security.revoked.clear(); security.blacklist.mockClear(); });

async function identity() {
  const customer = await Customer.create({ name: 'Security Test', email: 'boundary@example.test', emailVerified: true });
  const token = generateToken({ id: customer.id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '7d');
  return { customer, token };
}

describe('browser and account security boundaries', () => {
  it('limits concurrent email-verification guesses per issued code', async () => {
    const { customer } = await identity();
    await Customer.updateOne({ _id: customer._id }, { emailVerified: false, otp: hashResetCode('123456'), otpExpiry: new Date(Date.now() + 600000), otpAttempts: 0 });
    const app = testApp();
    await Promise.all(Array.from({ length: 8 }, () => request(app).post('/api/v1/customer/auth/verify-otp').set('Origin', TEST_ORIGIN).send({ email: customer.email, otp: '000000' })));
    const burned = await request(app).post('/api/v1/customer/auth/verify-otp').set('Origin', TEST_ORIGIN).send({ email: customer.email, otp: '123456' });
    expect(burned.status).toBe(400);
    expect((await Customer.findById(customer._id))?.emailVerified).toBe(false);
  });

  it('consumes a password-reset code only once under simultaneous submissions', async () => {
    const { customer } = await identity();
    await Customer.updateOne({ _id: customer._id }, { resetOtpHash: hashResetCode('123456'), resetOtpExpiry: new Date(Date.now() + 600000), resetOtpAttempts: 0 });
    const app = testApp();
    const results = await Promise.all(['NewPassword1', 'NewPassword2'].map(password => request(app).post('/api/v1/customer/auth/reset-password').set('Origin', TEST_ORIGIN).send({ email: customer.email, otp: '123456', password })));
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
  });

  it('allows the inventory idempotency header in a browser preflight', async () => {
    const response = await request(testApp()).options('/api/v1/seller/listings/000000000000000000000001/inventory/adjust')
      .set('Origin', TEST_ORIGIN).set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('idempotency-key');
  });

  it('does not bind a revoked-by-password-change token to a private cart', async () => {
    const { customer, token } = await identity();
    await Customer.updateOne({ _id: customer._id }, { credentialsChangedAt: new Date(Date.now() + 1000) });
    const req = { headers: { cookie: `nexmart_customer_session=${token}` } } as Request & { user?: unknown };
    const next = vi.fn();
    await optionalCustomerAuth(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('revokes bearer-only sessions on logout, including OAuth sessions', async () => {
    const { token } = await identity();
    const app = testApp();
    expect((await request(app).get('/api/v1/customer/profile').auth(token, { type: 'bearer' })).status).toBe(200);
    const logout = await request(app).post('/api/v1/auth/logout').set('Origin', TEST_ORIGIN).auth(token, { type: 'bearer' });
    expect(logout.status).toBe(200);
    expect((await request(app).get('/api/v1/customer/profile').auth(token, { type: 'bearer' })).status).toBe(401);
  });

  it('does not trust an unsigned logout cookie to populate the revocation store', async () => {
    const forged = jwt.sign({ jti: 'victim-session', role: 'customer' }, 'attacker-key', { expiresIn: '7d' });
    await request(testApp()).post('/api/v1/auth/logout').set('Origin', TEST_ORIGIN).set('Cookie', `nexmart_customer_session=${forged}`);
    expect(security.blacklist).not.toHaveBeenCalled();
  });
});
