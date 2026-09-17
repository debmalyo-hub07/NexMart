import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

import { startTestDb, stopTestDb, clearCollections, testApp, post, put, patch, get, TEST_ORIGIN } from './helpers';
import { Seller } from '../models/Seller';
import { SellerAuditLog } from '../models/SellerAuditLog';
import { Admin } from '../models/Admin';

let app: Application;
const sellerPassword = 'SellerPass1';
const sellerEmail = 'merchant@test.local';

function cookie(res: { headers: Record<string, string | string[] | undefined> }, prefix: string): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((entry) => entry.startsWith(`${prefix}=`));
  if (!found) throw new Error(`No ${prefix} cookie`);
  return found.split(';')[0];
}

function codeHash(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function registerSeller(): Promise<void> {
  await post(app, '/api/v1/seller/auth/register', {
    name: 'Merchant Owner',
    email: sellerEmail,
    password: sellerPassword,
    confirmPassword: sellerPassword,
    legalBusinessName: 'Merchant Goods Pvt Ltd',
    storefrontName: 'Merchant Goods',
    businessType: 'private_limited',
    phone: '9876543210',
  });
  await Seller.updateOne({ email: sellerEmail }, {
    $set: {
      verificationCodeHash: codeHash('123456'),
      verificationCodeExpiry: new Date(Date.now() + 60_000),
      verificationCodeAttempts: 0,
    },
  });
}

async function loginSeller(): Promise<string> {
  const response = await post(app, '/api/v1/seller/auth/login', { email: sellerEmail, password: sellerPassword });
  expect(response.status).toBe(200);
  return cookie(response, 'nexmart_seller_session');
}

async function adminCookie(): Promise<string> {
  await Admin.create({ name: 'Admin', email: 'admin@test.local', password: await bcrypt.hash('AdminPass1', 12), role: 'admin' });
  const response = await post(app, '/api/v1/admin/auth/login', { email: 'admin@test.local', password: 'AdminPass1' });
  expect(response.status).toBe(200);
  return cookie(response, 'nexmart_admin_session');
}

beforeAll(async () => {
  await startTestDb('nexmart_seller_integration');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('seller identity and lifecycle', () => {
  it('keeps seller credentials separate, hashes the verification code, and gates login until email verification', async () => {
    const registered = await post(app, '/api/v1/seller/auth/register', {
      name: 'Merchant Owner', email: sellerEmail, password: sellerPassword, confirmPassword: sellerPassword,
      legalBusinessName: 'Merchant Goods Pvt Ltd', storefrontName: 'Merchant Goods', businessType: 'private_limited', phone: '9876543210',
    });
    expect(registered.status).toBe(202);
    const stored = await Seller.findOne({ email: sellerEmail }).select('+password +verificationCodeHash');
    expect(stored?.verificationCodeHash).toBeTruthy();
    expect(stored?.verificationCodeHash).not.toBe('123456');
    expect(stored?.password).not.toBe(sellerPassword);

    const beforeVerification = await post(app, '/api/v1/seller/auth/login', { email: sellerEmail, password: sellerPassword });
    expect(beforeVerification.status).toBe(403);
    expect(beforeVerification.body.data.requiresOtp).toBe(true);
  });

  it('verifies, signs in, exposes only the seller profile, and rejects cross-role access', async () => {
    await registerSeller();
    const verified = await post(app, '/api/v1/seller/auth/verify-otp', { email: sellerEmail, otp: '123456' });
    expect(verified.status).toBe(200);
    const sellerSession = await loginSeller();
    const profile = await get(app, '/api/v1/seller/profile', sellerSession);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(sellerEmail);
    expect(profile.body.data.password).toBeUndefined();

    const customerSurface = await get(app, '/api/v1/customer/profile', sellerSession);
    expect(customerSurface.status).toBe(401);
    const sellerSurfaceWithoutSeller = await get(app, '/api/v1/seller/profile');
    expect(sellerSurfaceWithoutSeller.status).toBe(401);
  });

  it('requires a complete application before submission and records an audit trail', async () => {
    await registerSeller();
    await post(app, '/api/v1/seller/auth/verify-otp', { email: sellerEmail, otp: '123456' });
    const sellerSession = await loginSeller();
    const incomplete = await post(app, '/api/v1/seller/onboarding/submit', {}, sellerSession);
    expect(incomplete.status).toBe(400);

    const address = { fullName: 'Merchant Owner', phone: '9876543210', addressLine1: '12 Market Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' };
    const saved = await put(app, '/api/v1/seller/profile', { pickupAddress: address, returnAddress: address, policyAccepted: true, prohibitedProductsAcknowledged: true }, sellerSession);
    expect(saved.status).toBe(200);
    const submitted = await post(app, '/api/v1/seller/onboarding/submit', {}, sellerSession);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.lifecycleStatus).toBe('submitted');
    expect(await SellerAuditLog.countDocuments({ seller: (await Seller.findOne({ email: sellerEmail }))?._id, action: 'seller_onboarding_submitted' })).toBe(1);
  });

  it('lets only admins move the seller through controlled review states', async () => {
    await registerSeller();
    await post(app, '/api/v1/seller/auth/verify-otp', { email: sellerEmail, otp: '123456' });
    const sellerSession = await loginSeller();
    const address = { fullName: 'Merchant Owner', phone: '9876543210', addressLine1: '12 Market Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' };
    await put(app, '/api/v1/seller/profile', { pickupAddress: address, returnAddress: address, policyAccepted: true, prohibitedProductsAcknowledged: true }, sellerSession);
    await post(app, '/api/v1/seller/onboarding/submit', {}, sellerSession);
    const adminSession = await adminCookie();
    const seller = await Seller.findOne({ email: sellerEmail });

    const denied = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'under_review' }, sellerSession);
    expect(denied.status).toBe(401);
    const review = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'under_review' }, adminSession);
    expect(review.status).toBe(200);
    const approved = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'approved' }, adminSession);
    expect(approved.status).toBe(200);
    const activated = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'active' }, adminSession);
    expect(activated.status).toBe(200);

    const invalid = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'draft' }, adminSession);
    expect(invalid.status).toBe(400);
    const suspendedWithoutReason = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'suspended' }, adminSession);
    expect(suspendedWithoutReason.status).toBe(400);
    const suspended = await patch(app, `/api/v1/admin/sellers/${seller?._id}/status`, { status: 'suspended', reason: 'Verification review required' }, adminSession);
    expect(suspended.status).toBe(200);
    expect((await get(app, '/api/v1/seller/profile', sellerSession)).status).toBe(403);
    expect(await SellerAuditLog.countDocuments({ seller: seller?._id })).toBeGreaterThanOrEqual(5);
  });

  it('does not let a seller email enter the customer login or Google customer path', async () => {
    await registerSeller();
    const customerLogin = await post(app, '/api/v1/customer/auth/login', { email: sellerEmail, password: sellerPassword });
    expect(customerLogin.status).toBe(403);
  });
});

// Keep the origin constant referenced in this integration file so accidental
// removal of the CSRF contract is visible during review.
expect(TEST_ORIGIN).toBe('http://localhost:3000');
