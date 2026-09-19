import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Category } from '../../models/Category';
import { Product } from '../../models/Product';
import { Seller } from '../../models/Seller';
import { SellerListing } from '../../models/SellerListing';
import { SellerInventory } from '../../models/SellerInventory';
import { clearCollections, startTestDb, stopTestDb } from '../../test/helpers';
import { getPublicSellerStorefront } from '../seller.controller';
import { getProductOffers } from '../listing.controller';

type StorefrontPayload = {
  data: {
    seller: { verification: string; email?: string; phone?: string; returnPolicy?: unknown };
    listings: Array<{ _id: string; canonicalVariantSku?: string; moderationReason?: string; metadata?: unknown; inventory: { available: number } }>;
    pagination: { total: number; totalPages: number; page: number };
  };
};
let category: InstanceType<typeof Category>;
let product: InstanceType<typeof Product>;
let seller: InstanceType<typeof Seller>;
let listing: InstanceType<typeof SellerListing>;

async function storefront(query: Record<string, string> = {}) {
  let status = 200;
  let payload: StorefrontPayload | undefined;
  const response = {
    status: (code: number) => { status = code; return response; },
    json: (value: StorefrontPayload) => { payload = JSON.parse(JSON.stringify(value)); return response; },
  };
  await getPublicSellerStorefront({ params: { id: String(seller._id) }, query } as unknown as Request, response as unknown as Response);
  return { status, body: payload! };
}

async function offers() {
  type Offer = { id: string; metadata?: unknown; sellerSku?: string; inventory: { available: number; reserved?: number } };
  let status = 200;
  let payload: { data: Offer[] } | undefined;
  const response = {
    status: (code: number) => { status = code; return response; },
    json: (value: typeof payload) => { payload = JSON.parse(JSON.stringify(value)); return response; },
  };
  await getProductOffers({ params: { id: String(product._id) } } as unknown as Request, response as unknown as Response);
  return { status, body: payload! };
}

beforeAll(() => startTestDb('public_seller_storefront'), 60000);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearCollections();
  category = await Category.create({ name: 'Test department', slug: 'test-department' });
  product = await Product.create({ name: 'Test product', slug: 'test-product', description: 'Test product details', category: category._id, createdBy: new mongoose.Types.ObjectId(), isPublished: true, variants: [{ sku: 'OPTION-A', price: 900, stock: 0 }] });
  seller = await Seller.create({ name: 'Test seller', email: 'seller@example.test', phone: '9876543210', legalBusinessName: 'Test business', storefrontName: 'Test store', businessType: 'individual', lifecycleStatus: 'active', kycState: 'verified', complianceState: 'verified' });
  listing = await SellerListing.create({ seller: seller._id, canonicalProduct: product._id, canonicalVariantSku: 'OPTION-A', sellerSku: 'INTERNAL-SKU', pricePaise: 75000, status: 'published', moderationReason: 'Private review note', metadata: { privateReference: 'internal-only' } });
  const inventory = await SellerInventory.create({ seller: seller._id, listing: listing._id, available: 3 });
  listing.inventory = inventory._id as mongoose.Types.ObjectId;
  await listing.save();
});

describe('truthful public seller storefronts', () => {
  it('derives verification from recorded checks and returns no private contacts or moderation data', async () => {
    const result = await storefront();
    expect(result.status).toBe(200);
    expect(result.body.data.seller.verification).toBe('verified');
    expect(result.body.data.seller.email).toBeUndefined();
    expect(result.body.data.seller.phone).toBeUndefined();
    expect(result.body.data.seller.returnPolicy).toBeUndefined();
    expect(result.body.data.listings[0]).toMatchObject({ canonicalVariantSku: 'OPTION-A', inventory: { available: 3 } });
    expect(result.body.data.listings[0].moderationReason).toBeUndefined();
    expect(result.body.data.listings[0].metadata).toBeUndefined();
  });
  it('does not label incomplete verification as verified', async () => {
    seller.complianceState = 'pending'; await seller.save();
    expect((await storefront()).body.data.seller.verification).toBe('standard');
  });
  it('hides unpublished canonical products even when an offer remains published', async () => {
    product.isPublished = false; await product.save();
    expect((await storefront()).body.data.listings).toEqual([]);
  });
  it('hides products beneath inactive departments', async () => {
    category.isActive = false; await category.save();
    expect((await storefront()).body.data.listings).toEqual([]);
  });
  it('hides products with inactive subcategories', async () => {
    const child = await Category.create({ name: 'Hidden child', slug: 'hidden-child', parent: category._id, isActive: false });
    product.subCategory = String(child._id); await product.save();
    expect((await storefront()).body.data.listings).toEqual([]);
  });
  it('does not advertise sample merchandise as a seller offer', async () => {
    product.isDemo = true; await product.save();
    expect((await storefront()).body.data.listings).toEqual([]);
  });
  it('does not advertise an option that no longer exists', async () => {
    listing.canonicalVariantSku = 'REMOVED-OPTION'; await listing.save();
    expect((await storefront()).body.data.listings).toEqual([]);
  });
  it('fails closed when inventory belongs to another seller', async () => {
    await SellerInventory.updateOne({ listing: listing._id }, { seller: new mongoose.Types.ObjectId() });
    expect((await storefront()).body.data.listings[0].inventory.available).toBe(0);
  });
  it('paginates only visible offers with an accurate total', async () => {
    await SellerListing.create([
      { seller: seller._id, canonicalProduct: product._id, sellerSku: 'SECOND', pricePaise: 85000, status: 'published' },
      { seller: seller._id, canonicalProduct: product._id, sellerSku: 'HIDDEN', pricePaise: 95000, status: 'paused' },
    ]);
    const first = await storefront({ limit: '1', page: '1' });
    const second = await storefront({ limit: '1', page: '2' });
    expect(first.body.data.pagination).toMatchObject({ total: 2, totalPages: 2, page: 1 });
    expect(second.body.data.pagination.page).toBe(2);
    expect(first.body.data.listings).toHaveLength(1);
    expect(second.body.data.listings).toHaveLength(1);
    expect(first.body.data.listings[0]._id).not.toBe(second.body.data.listings[0]._id);
  });
});

describe('public product offer discovery uses the same visibility and inventory rules', () => {
  it('does not expose seller-only metadata, SKUs or inventory counters', async () => {
    const result = await offers();
    expect(result.status).toBe(200);
    expect(result.body.data[0].metadata).toBeUndefined();
    expect(result.body.data[0].sellerSku).toBeUndefined();
    expect(result.body.data[0].inventory).toEqual({ available: 3 });
  });
  it('does not expose offers through a hidden department', async () => {
    category.isActive = false; await category.save();
    expect((await offers()).status).toBe(404);
  });
  it('does not expose sample merchandise as purchasable offers', async () => {
    product.isDemo = true; await product.save();
    expect((await offers()).status).toBe(404);
  });
  it('excludes removed canonical options', async () => {
    listing.canonicalVariantSku = 'REMOVED'; await listing.save();
    expect((await offers()).body.data).toEqual([]);
  });
  it('does not advertise another seller inventory', async () => {
    await SellerInventory.updateOne({ listing: listing._id }, { seller: new mongoose.Types.ObjectId() });
    expect((await offers()).body.data[0].inventory.available).toBe(0);
  });
});
