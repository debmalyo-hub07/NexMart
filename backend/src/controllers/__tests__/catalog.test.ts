import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ find: vi.fn(), sort: vi.fn(), cache: vi.fn() }));
vi.mock('../../models/Product', () => ({ Product: { find: mocks.find, countDocuments: vi.fn(async () => 0) } }));
vi.mock('../../config/redis', () => ({ upstashRedis: { get: mocks.cache, set: vi.fn(), del: vi.fn() } }));
vi.mock('../../utils/helpers', async importOriginal => ({ ...(await importOriginal<object>()), resolveCategoryFilter: vi.fn(async () => 'category-id') }));
import { getProducts } from '../product.controller';
import { searchProducts } from '../search.controller';

const request = (query: Record<string, string>) => ({ query }) as unknown as Request;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as unknown as Response;

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { populate: vi.fn().mockReturnThis(), sort: mocks.sort, skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn(async () => []) };
  mocks.sort.mockReturnValue(chain);
  mocks.find.mockReturnValue(chain);
});

describe('catalog discovery contract', () => {
  it.each([getProducts, searchProducts])('finds a product through its subcategory as well as its main category', async handler => {
    await handler(request({ category: 'phones', inStock: 'true', featured: 'true' }), response());
    expect(mocks.find.mock.calls[0][0]).toMatchObject({ isPublished: true, isFeatured: true, 'variants.stock': { $gt: 0 }, $and: [{ $or: [{ category: 'category-id' }, { subCategory: 'category-id' }] }] });
  });
  it('keeps filtered featured queries out of the homepage cache', async () => {
    await getProducts(request({ featured: 'true', limit: '8', inStock: 'true' }), response());
    expect(mocks.cache).not.toHaveBeenCalled();
  });
  it('uses relevance by default and respects an explicit price sort', async () => {
    await searchProducts(request({ q: 'phone' }), response());
    expect(mocks.sort).toHaveBeenLastCalledWith(expect.objectContaining({ score: { $meta: 'textScore' } }));
    await searchProducts(request({ q: 'phone', sort: 'variants.0.price' }), response());
    expect(mocks.sort).toHaveBeenLastCalledWith({ 'variants.0.price': 1 });
  });
});
