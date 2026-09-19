import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('../../config/redis', () => ({ upstashRedis: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), del: vi.fn(async () => undefined) } }));

import { Product } from '../../models/Product';
import { Category } from '../../models/Category';
import '../../models/Customer';
import { getProducts, getProductBySlug } from '../product.controller';
import { searchProducts } from '../search.controller';
import { getCategories } from '../category.controller';

type Page = { data: Array<{ slug: string; image?: string | null; reviews?: unknown; richDescription?: string; catalog?: { price: number; variantSku: string } }>; meta: { total: number }; facets?: { brands: Array<{ value: string; count: number }> }; search?: { mode: string } };
async function invoke(handler: (req: Request, res: Response) => Promise<void>, query: Record<string, string | undefined> = {}, params: Record<string, string> = {}) {
  let status = 200;
  let body: Page | undefined;
  const response = { status: (code: number) => { status = code; return response; }, json: (value: Page) => { body = value; return response; }, set: () => response, setHeader: () => response };
  await handler({ query, params } as unknown as Request, response as unknown as Response);
  return { status, body: body! };
}

let database: MongoMemoryServer;
let hiddenId: string;
let inactiveId: string;

beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'catalog_discovery_regression' });
  const root = await Category.create({ name: 'Mobiles & Tablets', slug: 'mobiles' });
  const child = await Category.create({ name: 'Smartphones', slug: 'smartphones', parent: root._id });
  const audio = await Category.create({ name: 'Audio', slug: 'audio' });
  const inactive = await Category.create({ name: 'Hidden category', slug: 'hidden-category', isActive: false });
  inactiveId = String(inactive._id);
  const hiddenChild = await Category.create({ name: 'Hidden descendant', slug: 'hidden-descendant', parent: inactive._id });
  const base = { description: 'A detailed product description.', createdBy: new mongoose.Types.ObjectId(), isPublished: true, category: root._id, richDescription: 'Long content not needed in the product grid.' };
  const products = await Product.create([
    { ...base, name: 'Samsung Galaxy S25', slug: 'galaxy', brand: 'Samsung', subCategory: String(child._id), images: ['https://example.com/galaxy.jpg'], variants: [{ sku: 'galaxy-unavailable', price: 90000, stock: 0 }, { sku: 'galaxy-256', price: 40000, stock: 5, attributes: { Storage: '256 GB', Colour: 'Silver' } }], specifications: { RAM: '12 GB' } },
    { ...base, name: 'Samsung A16', slug: 'a16', brand: 'Samsung', category: child._id, variants: [{ sku: 'a16', price: 20000, stock: 3 }] },
    { ...base, name: 'Samsung case', slug: 'case', brand: 'Samsung', variants: [{ sku: 'case', price: 500, stock: 5 }] },
    { ...base, name: 'Orbit phone', slug: 'orbit', brand: 'Orbit', variants: [{ sku: 'orbit-cheap', price: 10000, stock: 0 }, { sku: 'orbit-stock', price: 60000, stock: 4 }] },
    { ...base, name: 'Studio headphones', slug: 'headphones', brand: 'Studio', category: audio._id, variants: [{ sku: 'audio', price: 5000, stock: 2 }] },
    { ...base, name: 'Samsungish case', slug: 'samsungish', brand: 'Samsungish', variants: [{ sku: 'case-other', price: 700, stock: 3 }] },
    { ...base, name: 'Unpublished phone', slug: 'hidden-product', isPublished: false, variants: [{ sku: 'hidden', price: 1, stock: 10 }] },
    { ...base, name: 'Hidden category product', slug: 'inactive-product', category: inactive._id, variants: [{ sku: 'inactive', price: 1, stock: 10 }] },
    { ...base, name: 'Hidden ancestor item', slug: 'hidden-ancestor-product', category: hiddenChild._id, variants: [{ sku: 'ancestor', price: 1, stock: 10 }] },
    { ...base, name: 'Hidden subcategory item', slug: 'hidden-subcategory-product', subCategory: String(hiddenChild._id), variants: [{ sku: 'hidden-sub', price: 1, stock: 10 }] },
  ]);
  hiddenId = String(products[6]._id);
  await Promise.all([Product.init(), Category.init()]);
}, 60000);

afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });

describe('shared catalog discovery against MongoDB', () => {
  it.each([getProducts, searchProducts])('requires price and stock to match the same purchasable option', async handler => {
    const { body } = await invoke(handler, { minPrice: '30000', maxPrice: '45000', inStock: 'true' });
    expect(body.data.map(product => product.slug)).toEqual(['galaxy']);
    expect(body.data[0].catalog).toMatchObject({ price: 40000, variantSku: 'galaxy-256' });
    const cheap = await invoke(handler, { minPrice: '9000', maxPrice: '11000', inStock: 'true' });
    expect(cheap.body.meta.total).toBe(0);
  });
  it('includes products assigned directly to a child when browsing its parent', async () => {
    const { body } = await invoke(getProducts, { category: 'mobiles' });
    expect(body.data.map(product => product.slug)).toContain('a16');
    expect(body.data.map(product => product.slug)).not.toContain('headphones');
  });
  it('uses OR within brands, exact brand matching, and AND between filter groups', async () => {
    const { body } = await invoke(searchProducts, { brand: 'Samsung,Orbit', minPrice: '19000', maxPrice: '65000', inStock: 'true' });
    expect(body.data.map(product => product.slug).sort()).toEqual(['a16', 'galaxy', 'orbit']);
    expect(body.facets?.brands.some(brand => brand.value === 'Samsung')).toBe(true);
    const exact = await invoke(getProducts, { brand: 'Samsung', maxPrice: '1000' });
    expect(exact.body.data.map(product => product.slug)).toEqual(['case']);
  });
  it('sorts the same displayed available price that the card receives', async () => {
    const { body } = await invoke(getProducts, { brand: 'Samsung,Orbit', minPrice: '1000', sort: 'variants.0.price' });
    expect(body.data.map(product => product.slug)).toEqual(['a16', 'galaxy', 'orbit']);
  });
  it.each([getProducts, searchProducts])('matches all query tokens, including partial models and variant attributes', async handler => {
    expect((await invoke(handler, { q: 'sams gal 256gb' })).body.data.map(product => product.slug)).toEqual(['galaxy']);
    expect((await invoke(handler, { q: 'Samsung Galaxy' })).body.data.map(product => product.slug)).toEqual(['galaxy']);
  });
  it('finds products through the taxonomy even when category text is absent from titles', async () => {
    expect((await invoke(searchProducts, { q: 'smartphones' })).body.data.map(product => product.slug).sort()).toEqual(['a16', 'galaxy']);
  });
  it('offers explicitly labelled close matches after a one-character typo', async () => {
    const { body } = await invoke(searchProducts, { q: 'samsng galaxy' });
    expect(body.data.map(product => product.slug)).toEqual(['galaxy']);
    expect(body.search?.mode).toBe('approximate');
  });
  it('never exposes an unpublished product through its public object id', async () => {
    expect((await invoke(getProductBySlug, {}, { slug: hiddenId })).status).toBe(404);
  });
  it('gives every category a stable cover image across repeated requests', async () => {
    const first = await invoke(getCategories);
    const second = await invoke(getCategories);
    const covers = first.body.data.map(item => [item.slug, item.image]);
    expect(covers).toEqual(second.body.data.map(item => [item.slug, item.image]));
    // Products without images never shadow a real cover.
    expect(covers.find(([slug]) => slug === 'mobiles')?.[1]).toBe('https://example.com/galaxy.jpg');
  });
  it('honors category visibility even when a filter uses an object id', async () => {
    expect((await invoke(getProducts, { category: inactiveId })).body.meta.total).toBe(0);
  });
  it('does not ignore the ninth search word', async () => {
    expect((await invoke(getProducts, { q: 'samsung galaxy s25 samsung galaxy s25 samsung galaxy nonexistentxyz' })).body.meta.total).toBe(0);
  });
  it('hides active descendants of inactive departments in products and the directory', async () => {
    const products = (await invoke(getProducts)).body.data.map(item => item.slug);
    expect(products).not.toContain('hidden-ancestor-product');
    expect(products).not.toContain('hidden-subcategory-product');
    expect((await invoke(getCategories)).body.data.map(item => item.slug)).not.toContain('hidden-descendant');
  });
  it.each(['inactive-product', 'hidden-ancestor-product', 'hidden-subcategory-product'])('does not reveal a hidden-category product at its public detail URL: %s', async slug => {
    expect((await invoke(getProductBySlug, {}, { slug })).status).toBe(404);
  });
  it('omits embedded review bodies and rich descriptions from list payloads', async () => {
    const { body } = await invoke(getProducts);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).not.toHaveProperty('reviews');
    expect(body.data[0]).not.toHaveProperty('richDescription');
  });
  it.each([{ minPrice: 'NaN' }, { rating: '99' }, { minPrice: '50', maxPrice: '10' }])('validates direct API filter input: %j', async query => {
    await expect(invoke(getProducts, query)).rejects.toThrow();
  });
});
