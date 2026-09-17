import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

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
vi.mock('../services/email.service', () => ({ sendEmail: vi.fn(async () => undefined), buildOtpEmail: vi.fn(() => '<p>otp</p>') }));

import { startReplicaTestDb, stopTestDb, clearCollections, testApp, post, get, put, patch } from './helpers';
import { Seller } from '../models/Seller';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { InventoryMovement } from '../models/InventoryMovement';
import { Product } from '../models/Product';
import { Admin } from '../models/Admin';
import { migrateLegacyCatalog, rollbackLegacyCatalogMigration, FIRST_PARTY_SELLER_EMAIL } from '../services/marketplaceCatalogMigration.service';

let app: Application;
let productId: string;
let sellerOneId: string;

function cookie(res: { headers: Record<string, string | string[] | undefined> }, prefix: string): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((entry) => entry.startsWith(`${prefix}=`));
  if (!found) throw new Error(`No ${prefix} cookie`);
  return found.split(';')[0];
}

async function loginSeller(email: string, password: string): Promise<string> {
  const response = await post(app, '/api/v1/seller/auth/login', { email, password });
  expect(response.status).toBe(200);
  return cookie(response, 'nexmart_seller_session');
}

async function loginAdmin(): Promise<string> {
  const response = await post(app, '/api/v1/admin/auth/login', { email: 'listing-admin@test.local', password: 'AdminPass1' });
  expect(response.status).toBe(200);
  return cookie(response, 'nexmart_admin_session');
}

beforeAll(async () => {
  await startReplicaTestDb('nexmart_listing_integration');
  app = testApp();
}, 120_000);

afterAll(async () => { await stopTestDb(); });

beforeEach(async () => {
  await clearCollections();
  const password = await bcrypt.hash('SellerPass1', 12);
  const [one] = await Seller.create([
    { name: 'Seller One', email: 'one@listing.test', password, phone: '9876543210', legalBusinessName: 'One Goods', storefrontName: 'One Goods', businessType: 'individual', emailVerified: true, lifecycleStatus: 'active', isActive: true },
    { name: 'Seller Two', email: 'two@listing.test', password, phone: '9876543211', legalBusinessName: 'Two Goods', storefrontName: 'Two Goods', businessType: 'individual', emailVerified: true, lifecycleStatus: 'active', isActive: true },
  ]);
  sellerOneId = String(one._id);
  await Admin.create({ name: 'Listing Admin', email: 'listing-admin@test.local', password: await bcrypt.hash('AdminPass1', 12), role: 'admin' });
  const product = await Product.create({ name: 'Canonical phone', slug: 'canonical-phone', description: 'A canonical product used by listing tests.', category: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(), isPublished: true, variants: [{ sku: 'base', price: 100, stock: 0 }] });
  productId = String(product._id);
});

describe('seller listings and inventory', () => {
  it('keeps listing ownership server-side and prevents negative inventory', async () => {
    const sellerOne = await loginSeller('one@listing.test', 'SellerPass1');
    const sellerTwo = await loginSeller('two@listing.test', 'SellerPass1');
    const created = await post(app, '/api/v1/seller/listings', { canonicalProduct: productId, canonicalVariantSku: 'base', sellerSku: 'ONE-BASE', pricePaise: 12500, openingStock: 3 }, sellerOne);
    expect(created.status).toBe(201);
    const listingId = String(created.body.data.id);

    const denied = await get(app, `/api/v1/seller/listings/${listingId}`, sellerTwo);
    expect(denied.status).toBe(404);
    const overdrawn = await post(app, `/api/v1/seller/listings/${listingId}/inventory/adjust`, { delta: -4, reason: 'damage_reported', idempotencyKey: 'overdrawn-1' }, sellerOne);
    expect(overdrawn.status).toBe(400);
    expect((await SellerInventory.findOne({ listing: listingId }))?.available).toBe(3);
    expect(await SellerListing.countDocuments({ seller: sellerOneId })).toBe(1);
    const adjusted = await post(app, `/api/v1/seller/listings/${listingId}/inventory/adjust`, { delta: -1, reason: 'damage_reported', idempotencyKey: 'damage-1' }, sellerOne);
    expect(adjusted.status).toBe(200);
    const replay = await post(app, `/api/v1/seller/listings/${listingId}/inventory/adjust`, { delta: -1, reason: 'damage_reported', idempotencyKey: 'damage-1' }, sellerOne);
    expect(replay.status).toBe(200);
    expect((await SellerInventory.findOne({ listing: listingId }))?.available).toBe(2);
    expect(await InventoryMovement.countDocuments({ listing: listingId, idempotencyKey: 'damage-1' })).toBe(1);
  });

  it('requires moderation before a listing appears in public offers', async () => {
    const seller = await loginSeller('one@listing.test', 'SellerPass1');
    const admin = await loginAdmin();
    const created = await post(app, '/api/v1/seller/listings', { canonicalProduct: productId, canonicalVariantSku: 'base', sellerSku: 'ONE-PUBLISH', pricePaise: 12500, openingStock: 3 }, seller);
    const listingId = String(created.body.data.id);
    expect((await get(app, `/api/v1/products/${productId}/offers`)).body.data).toHaveLength(0);

    expect((await post(app, `/api/v1/seller/listings/${listingId}/submit`, {}, seller)).status).toBe(200);
    expect((await patch(app, `/api/v1/admin/listings/${listingId}/status`, { status: 'moderation' }, admin)).status).toBe(200);
    expect((await patch(app, `/api/v1/admin/listings/${listingId}/status`, { status: 'approved' }, admin)).status).toBe(200);
    expect((await patch(app, `/api/v1/admin/listings/${listingId}/status`, { status: 'published' }, admin)).status).toBe(200);

    const offers = await get(app, `/api/v1/products/${productId}/offers`);
    expect(offers.status).toBe(200);
    expect(offers.body.data).toHaveLength(1);
    expect(offers.body.data[0].seller.storefrontName).toBe('One Goods');
    expect(offers.body.data[0].seller.verification).toBe('standard');
  });

  it('does not let a seller self-publish or rewrite canonical product identity', async () => {
    const seller = await loginSeller('one@listing.test', 'SellerPass1');
    const created = await post(app, '/api/v1/seller/listings', { canonicalProduct: productId, sellerSku: 'ONE-EDIT', pricePaise: 12500 }, seller);
    const listingId = String(created.body.data.id);
    const forged = await put(app, `/api/v1/seller/listings/${listingId}`, { canonicalProduct: new mongoose.Types.ObjectId().toString(), status: 'published', pricePaise: 13000 }, seller);
    expect(forged.status).toBe(422);
    const edited = await put(app, `/api/v1/seller/listings/${listingId}`, { canonicalVariantSku: 'base', pricePaise: 13000 }, seller);
    expect(edited.status).toBe(200);
    const saved = await SellerListing.findById(listingId);
    expect(String(saved?.canonicalProduct)).toBe(productId);
    expect(saved?.status).toBe('draft');
    expect(saved?.pricePaise).toBe(13000);
  });

  it('lands legacy variants into a first-party seller idempotently', async () => {
    const first = await migrateLegacyCatalog();
    expect(first.productsScanned).toBeGreaterThanOrEqual(1);
    const retail = await Seller.findOne({ email: FIRST_PARTY_SELLER_EMAIL });
    expect(retail?.sellerKind).toBe('first_party');
    const created = await SellerListing.find({ seller: retail?._id });
    expect(created).toHaveLength(1);
    expect(created[0].pricePaise).toBe(10000);
    expect(created[0].metadata.get('migrationSource')).toBe('legacy_admin_catalog_v1');

    await SellerListing.updateOne({ _id: created[0]._id }, { $set: { pricePaise: 77700 } });
    await SellerInventory.updateOne({ listing: created[0]._id }, { $set: { available: 9 } });
    const second = await migrateLegacyCatalog();
    expect(second.listingsCreated).toBe(0);
    expect((await SellerListing.findById(created[0]._id))?.pricePaise).toBe(77700);
    expect((await SellerInventory.findOne({ listing: created[0]._id }))?.available).toBe(9);

    const rollbackPreview = await rollbackLegacyCatalogMigration({ dryRun: true });
    expect(rollbackPreview.listings).toBe(1);
    const rollback = await rollbackLegacyCatalogMigration();
    expect(rollback.listings).toBe(1);
    expect(await SellerListing.countDocuments({ seller: retail?._id })).toBe(0);
  });
});
