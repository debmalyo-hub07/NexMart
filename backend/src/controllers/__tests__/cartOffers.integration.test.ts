import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../../models/Product';
import { Category } from '../../models/Category';
import { Cart } from '../../models/Cart';
import { Seller } from '../../models/Seller';
import { SellerListing } from '../../models/SellerListing';
import { SellerInventory } from '../../models/SellerInventory';
import { addToCart, getCart, mergeGuestCart, updateCartItem } from '../cart.controller';

type Payload = { data: { items: Array<{ _id: string; listing?: string; quantity: number; price: number; offer?: { price: number; stock: number; available: boolean } }>; adjustments?: string[] } };
async function invoke(handler: (req: Request, res: Response) => Promise<void>, body = {}, params = {}, userId?: string) {
  let status = 200;
  let payload: Payload | undefined;
  const response = { status: (code: number) => { status = code; return response; }, json: (value: Payload) => { payload = JSON.parse(JSON.stringify(value)); return response; } };
  await handler({ body, params, headers: { 'x-session-id': 'offer-test-guest' }, ...(userId ? { user: { userId, role: 'customer' } } : {}) } as unknown as Request, response as unknown as Response);
  return { status, body: payload! };
}
let database: MongoMemoryReplSet;
let product: InstanceType<typeof Product>;
let seller: InstanceType<typeof Seller>;
let listing: InstanceType<typeof SellerListing>;
beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  await mongoose.connect(database.getUri(), { dbName: 'cart_offer_regression' });
  await Promise.all([Cart.init(), Seller.init(), SellerListing.init(), SellerInventory.init()]);
}, 60000);
beforeEach(async () => {
  await Promise.all([Cart.deleteMany({}), Product.deleteMany({}), Category.deleteMany({}), Seller.deleteMany({}), SellerListing.deleteMany({}), SellerInventory.deleteMany({})]);
  const category = await Category.create({ name: 'Test department', slug: 'test-department' });
  product = await Product.create({ name: 'Test product', slug: 'test-product', description: 'Test details', category: category._id, createdBy: new mongoose.Types.ObjectId(), isPublished: true, variants: [{ sku: 'A', price: 900, stock: 50 }, { sku: 'B', price: 950, stock: 50 }] });
  seller = await Seller.create({ name: 'Test seller', email: 'seller@example.test', phone: '9876543210', legalBusinessName: 'Test seller', storefrontName: 'Test shop', businessType: 'individual', lifecycleStatus: 'active' });
  listing = await SellerListing.create({ seller: seller._id, canonicalProduct: product._id, canonicalVariantSku: 'A', sellerSku: 'A', pricePaise: 75000, status: 'published' });
  await SellerInventory.create({ seller: seller._id, listing: listing._id, available: 3 });
});
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });
const add = (quantity = 1) => invoke(addToCart, { productId: String(product._id), variant: 'A', listingId: String(listing._id), quantity });

describe('seller offer identity and availability through the cart', () => {
  it('rejects a listing for a different canonical product', async () => {
    listing.canonicalProduct = new mongoose.Types.ObjectId(); await listing.save();
    expect((await add()).status).toBe(400);
    expect(await Cart.countDocuments()).toBe(0);
  });
  it('rejects a listing for a different variant', async () => {
    expect((await invoke(addToCart, { productId: String(product._id), variant: 'B', listingId: String(listing._id) })).status).toBe(400);
  });
  it('rejects a suspended seller even if the listing is published', async () => {
    seller.lifecycleStatus = 'suspended'; await seller.save();
    expect((await add()).status).toBe(400);
  });
  it('does not use inventory belonging to a different seller', async () => {
    await SellerInventory.updateOne({ listing: listing._id }, { seller: new mongoose.Types.ObjectId() });
    expect((await add()).status).toBe(400);
  });
  it('checks cumulative cart quantity against seller stock', async () => {
    expect((await add(2)).status).toBe(200);
    expect((await add(2)).status).toBe(400);
    expect((await Cart.findOne())?.items[0].quantity).toBe(2);
  });
  it('uses seller stock on quantity updates, even when base inventory is empty', async () => {
    const added = await add();
    product.variants[0].stock = 0; await product.save();
    expect((await invoke(updateCartItem, { quantity: 2 }, { itemId: added.body.data.items[0]._id })).status).toBe(200);
  });
  it('rejects an update beyond the selected seller inventory', async () => {
    const added = await add();
    expect((await invoke(updateCartItem, { quantity: 4 }, { itemId: added.body.data.items[0]._id })).status).toBe(400);
  });
  it('returns current offer price and inventory instead of base product values', async () => {
    await add();
    listing.pricePaise = 72000; await listing.save();
    await SellerInventory.updateOne({ listing: listing._id }, { available: 2 });
    const result = await invoke(getCart);
    expect(result.body.data.items[0].price).toBe(750);
    expect(result.body.data.items[0].offer).toMatchObject({ price: 720, stock: 2, available: true });
  });
  it('keeps different listings separate from each other and the base option on login', async () => {
    const other = await SellerListing.create({ seller: seller._id, canonicalProduct: product._id, canonicalVariantSku: 'A', sellerSku: 'OTHER', pricePaise: 65000, status: 'published' });
    await SellerInventory.create({ seller: seller._id, listing: other._id, available: 4 });
    await Cart.create({ sessionId: 'offer-test-guest', items: [
      { product: product._id, variant: 'A', listing: listing._id, seller: seller._id, quantity: 1, price: 750 },
      { product: product._id, variant: 'A', listing: other._id, seller: seller._id, quantity: 1, price: 650 },
    ] });
    const userId = new mongoose.Types.ObjectId();
    await Cart.create({ user: userId, items: [{ product: product._id, variant: 'A', quantity: 1, price: 900 }] });
    const merged = await invoke(mergeGuestCart, { fromSession: true, items: [] }, {}, String(userId));
    expect(merged.body.data.items).toHaveLength(3);
    expect(merged.body.data.items.map(item => item.price).sort()).toEqual([650, 750, 900]);
    expect(merged.body.data.items.filter(item => item.listing)).toHaveLength(2);
    expect(await Cart.countDocuments({ sessionId: 'offer-test-guest' })).toBe(0);
  });
  it('preserves a seller offer through guest merge when base stock is zero', async () => {
    await add(); product.variants[0].stock = 0; await product.save();
    const result = await invoke(mergeGuestCart, { fromSession: true, items: [] }, {}, String(new mongoose.Types.ObjectId()));
    expect(result.body.data.items).toHaveLength(1);
    expect(result.body.data.items[0].listing).toBe(String(listing._id));
  });
  it('revalidates seller lifecycle on guest merge', async () => {
    await add(); seller.lifecycleStatus = 'suspended'; await seller.save();
    const result = await invoke(mergeGuestCart, { fromSession: true, items: [] }, {}, String(new mongoose.Types.ObjectId()));
    expect(result.body.data.items).toHaveLength(0);
    expect(result.body.data.adjustments?.length).toBeGreaterThan(0);
  });
  it('blocks sample products even if someone accidentally supplies positive stock', async () => {
    product.isDemo = true; await product.save();
    expect((await add()).status).toBe(400);
  });
});
