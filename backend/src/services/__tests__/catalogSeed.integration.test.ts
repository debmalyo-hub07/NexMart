import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Category } from '../../models/Category';
import { Product } from '../../models/Product';
import { seedDemoCatalog } from '../catalogSeed.service';

let database: MongoMemoryServer;
beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'catalog_seed_regression' });
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });
describe('additive starter catalog', () => {
  it('preserves category IDs and real merchandise, and is safe to rerun', async () => {
    const author = new mongoose.Types.ObjectId();
    const category = await Category.create({ name: 'Our electronics', slug: 'electronics', description: 'Keep our editorial content', displayOrder: 99, isActive: false });
    const product = await Product.create({ name: 'Original inventory', slug: 'original-inventory', description: 'Original real product description', createdBy: author, category: category._id, isPublished: true, variants: [{ sku: 'REAL', price: 1500, stock: 4 }] });
    const before = await Product.findById(product._id).lean();
    const first = await seedDemoCatalog(author);
    expect(first).toMatchObject({ added: 60, sampleProducts: 60, departments: 9 });
    expect(await Category.findOne({ slug: 'electronics' }).lean()).toMatchObject({ _id: category._id, name: 'Our electronics', description: 'Keep our editorial content', isActive: false, displayOrder: 99 });
    expect(await Product.findById(product._id).lean()).toEqual(before);
    const ids = (await Product.find({ slug: /^demo-/ }).select('_id').lean()).map(item => String(item._id)).sort();
    const second = await seedDemoCatalog(author);
    expect(second).toMatchObject({ added: 0, preserved: 60 });
    expect(await Product.countDocuments()).toBe(61);
    expect((await Product.find({ slug: /^demo-/ }).select('_id').lean()).map(item => String(item._id)).sort()).toEqual(ids);
    // Audit 2026-09-22 §A2: seeded catalog is sellable, not "Sample · not for sale".
    const samples = await Product.find({ slug: /^demo-/ }).lean();
    expect(samples).toHaveLength(60);
    expect(new Set(samples.map(item => String(item.category))).size).toBe(9);
    for (const sample of samples) {
      expect(sample.isDemo).toBe(false);
      expect(sample.name).not.toMatch(/^Demo · /);
      expect(sample.images.length).toBeGreaterThan(0);
      expect(sample.variants.every(option => option.stock > 0 && !!option.comparePrice && option.comparePrice! > option.price)).toBe(true);
      expect(sample.reviews).toHaveLength(0);
      expect(sample.ratings.count).toBe(0);
      expect(Object.keys(sample.specifications).length).toBeGreaterThan(0);
      expect(sample.demoSource).toContain('nexmart-demo-2026-09');
    }
    // A rerun must not re-flag or mutate the activated catalog.
    const rerun = await seedDemoCatalog(author);
    expect(rerun).toMatchObject({ added: 0, preserved: 60, activated: 0 });
  }, 60000);
});
