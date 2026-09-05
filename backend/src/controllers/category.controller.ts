import { Request, Response } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { generateSlug } from '../utils/helpers';

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  parent: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

import { upstashRedis } from '../config/redis';

async function clearCategoryCache() {
  try {
    const keys = await upstashRedis.keys('nexmart:categories:*');
    if (keys && keys.length > 0) {
      await upstashRedis.del(...keys);
    }
  } catch (err) {
    console.error('Redis cache invalidation failed for categories:', err);
  }
}

export async function getCategories(req: Request, res: Response): Promise<void> {
  // Admin-only flag: include deactivated categories so they remain manageable.
  // The admin caller (categories manager) passes ?includeInactive=true; public
  // storefront callers never do, so they keep seeing only active categories.
  const includeInactive = req.query.includeInactive === 'true';

  const filter: Record<string, unknown> = {};
  if (req.query.parent !== undefined) {
    filter.parent = req.query.parent === 'null' ? null : req.query.parent;
  }

  // Admin results get a distinct cache key and are never written to cache,
  // so they can never poison the public cache entries.
  const cacheKey = `nexmart:categories:${includeInactive ? 'admin' : (req.query.parent !== undefined ? String(req.query.parent) : 'all')}`;
  try {
    const cached = await upstashRedis.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }
  } catch (err) {
    console.error('Redis read error for categories:', err);
  }

  const categories = await Category.find(includeInactive ? filter : { ...filter, isActive: true })
    .populate('parent', 'name slug _id')
    .sort({ displayOrder: 1, name: 1 });

  if (!includeInactive) {
    try {
      await upstashRedis.set(cacheKey, categories, { ex: 300 }); // 5 minutes TTL
    } catch (err) {
      console.error('Redis write error for categories:', err);
    }
  }

  sendSuccess(res, categories);
}

export async function getCategoryBySlug(req: Request, res: Response): Promise<void> {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).populate('parent', 'name slug');
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  sendSuccess(res, category);
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const data = categorySchema.parse(req.body);
  const slug = generateSlug(data.name);
  const category = await Category.create({ ...data, slug });
  await clearCategoryCache();
  sendCreated(res, category);
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const data = categorySchema.partial().parse(req.body);
  const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  await clearCategoryCache();
  sendSuccess(res, category, 'Category updated');
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  await clearCategoryCache();
  sendSuccess(res, null, 'Category deleted');
}
