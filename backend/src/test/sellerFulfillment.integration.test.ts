import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
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

import { startReplicaTestDb, stopTestDb, clearCollections, testApp, post, get, patch } from './helpers';
import { registerAndVerify } from './helpers';
import { Seller } from '../models/Seller';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { Product } from '../models/Product';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { Shipment } from '../models/Shipment';

let app: Application;
const sellerPassword = 'SellerPass1';
const address = {
  fullName: 'Merchant Owner', phone: '9876543210', addressLine1: '12 Market Street',
  city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India',
};

function sessionCookie(res: { headers: Record<string, string | string[] | undefined> }, name: string): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((entry) => entry.startsWith(`${name}=`));
  if (!found) throw new Error(`No ${name} cookie`);
  return found.split(';')[0];
}

async function makeSeller(suffix: string): Promise<{ id: string; cookie: string; listing: InstanceType<typeof SellerListing>; inventory: InstanceType<typeof SellerInventory> }> {
  const seller = await Seller.create({
    name: `Merchant ${suffix}`, email: `merchant-${suffix}@test.local`, password: await bcrypt.hash(sellerPassword, 12),
    role: 'seller', phone: '9876543210', emailVerified: true, phoneVerified: true, isActive: true,
    lifecycleStatus: 'active', legalBusinessName: `Merchant ${suffix} Pvt Ltd`, storefrontName: `Merchant ${suffix}`,
    businessType: 'private_limited', pickupAddress: address, returnAddress: address,
  });
  const login = await post(app, '/api/v1/seller/auth/login', { email: seller.email, password: sellerPassword });
  expect(login.status).toBe(200);
  const listing = await SellerListing.create({
    seller: seller._id, canonicalProduct: new mongoose.Types.ObjectId(), canonicalVariantSku: 'sku',
    sellerSku: `SKU-${suffix}`, pricePaise: suffix === 'a' ? 10_000 : 12_000, status: 'published',
  });
  const inventory = await SellerInventory.create({ listing: listing._id, seller: seller._id, available: 2 });
  listing.inventory = inventory._id;
  await listing.save();
  return { id: String(seller._id), cookie: sessionCookie(login, 'nexmart_seller_session'), listing, inventory };
}

async function fixture(): Promise<{
  customerCookie: string;
  productId: string;
  sellerA: Awaited<ReturnType<typeof makeSeller>>;
  sellerB: Awaited<ReturnType<typeof makeSeller>>;
  groups: InstanceType<typeof FulfillmentGroup>[];
}> {
  const customer = await registerAndVerify(app, `buyer-${Date.now()}@test.local`, 'CustomerPass1');
  const product = await Product.create({
    name: 'Shared phone', slug: `shared-phone-${Date.now()}`, description: 'A canonical item', category: new mongoose.Types.ObjectId(),
    images: [], variants: [{ sku: 'sku', price: 100, stock: 0, images: [] }], tags: [], specifications: {},
    ratings: { average: 0, count: 0 }, reviews: [], isPublished: true, isFeatured: false, createdBy: new mongoose.Types.ObjectId(),
  });
  const sellerA = await makeSeller('a');
  const sellerB = await makeSeller('b');
  // The helper creates listings before the canonical product is known; bind
  // them to the product in a single test-owned update.
  await SellerListing.updateMany({}, { canonicalProduct: product._id });
  const response = await post(app, '/api/v1/orders', {
    checkoutId: crypto.randomUUID(),
    items: [
      { product: String(product._id), listing: String(sellerA.listing._id), variant: 'sku', quantity: 1, expectedPrice: 100 },
      { product: String(product._id), listing: String(sellerB.listing._id), variant: 'sku', quantity: 1, expectedPrice: 120 },
    ],
    shippingAddress: address, paymentMethod: 'cod', expectedTotal: 308.6,
  }, customer.cookie);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const groups = await FulfillmentGroup.find({ order: response.body.data.orderId }).sort('seller');
  expect(groups).toHaveLength(2);
  return { customerCookie: customer.cookie, productId: String(product._id), sellerA, sellerB, groups };
}

beforeAll(async () => { await startReplicaTestDb('nexmart_seller_fulfillment'); app = testApp(); }, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('seller fulfillment isolation and shipment idempotency', () => {
  it('denies cross-seller reads and writes, and releases only the cancelled group', async () => {
    const data = await fixture();
    const groupA = data.groups.find((group) => String(group.seller) === data.sellerA.id)!;
    const groupB = data.groups.find((group) => String(group.seller) === data.sellerB.id)!;

    expect((await get(app, `/api/v1/seller/fulfillment-groups/${groupB._id}`, data.sellerA.cookie)).status).toBe(404);
    expect((await patch(app, `/api/v1/seller/fulfillment-groups/${groupB._id}/status`, { status: 'cancelled' }, data.sellerA.cookie)).status).toBe(404);

    const cancelled = await patch(app, `/api/v1/seller/fulfillment-groups/${groupA._id}/status`, { status: 'cancelled' }, data.sellerA.cookie);
    expect(cancelled.status).toBe(200);
    const [inventoryA, inventoryB] = await Promise.all([
      SellerInventory.findById(data.sellerA.inventory._id), SellerInventory.findById(data.sellerB.inventory._id),
    ]);
    expect(inventoryA?.toObject()).toMatchObject({ available: 2, reserved: 0 });
    expect(inventoryB?.toObject()).toMatchObject({ available: 1, reserved: 1 });
  });

  it('allows the owner to progress a group and returns the same shipment on retries', async () => {
    const data = await fixture();
    const groupB = data.groups.find((group) => String(group.seller) === data.sellerB.id)!;
    for (const status of ['confirmed', 'processing', 'ready_for_pickup']) {
      const response = await patch(app, `/api/v1/seller/fulfillment-groups/${groupB._id}/status`, { status }, data.sellerB.cookie);
      expect(response.status).toBe(200);
    }
    const first = await post(app, `/api/v1/seller/fulfillment-groups/${groupB._id}/shipment`, {}, data.sellerB.cookie);
    const second = await post(app, `/api/v1/seller/fulfillment-groups/${groupB._id}/shipment`, {}, data.sellerB.cookie);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(String(first.body.data._id)).toBe(String(second.body.data._id));
    expect(await Shipment.countDocuments({ fulfillmentGroup: groupB._id })).toBe(1);
    expect((await SellerInventory.findById(data.sellerB.inventory._id))?.toObject()).toMatchObject({ available: 1, reserved: 0, committed: 1 });
  });
});
