import { Request, Response } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { categoryGroupStage, categorySummaries, type CategoryGroup } from '../services/catalog.service';
import { visibleCategories } from '../utils/categoryVisibility';
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
  const includeInactive = req.query.includeInactive === 'true';
  const [allCategories, groups] = await Promise.all([
    Category.find(includeInactive ? {} : { isActive: true }).sort({ displayOrder: 1, name: 1 }).lean(),
    Product.aggregate<CategoryGroup>([{ $match: { isPublished: true } }, categoryGroupStage]),
  ]);
  const categories = includeInactive ? allCategories : visibleCategories(allCategories);
  const ids = new Set(categories.map(category => String(category._id)));
  const summaries = categorySummaries(categories, includeInactive ? groups : groups.filter(group => ids.has(String(group._id.category)) && (!group._id.subCategory || ids.has(String(group._id.subCategory)))));
  const byId = new Map(categories.map(category => [String(category._id), category]));
  const selected = req.query.parent === undefined ? summaries : summaries.filter(category => req.query.parent === 'null' ? !category.parent : String(category.parent) === String(req.query.parent));
  res.setHeader('Cache-Control', includeInactive ? 'private, no-store' : 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
  sendSuccess(res, selected.map(category => ({ ...category, parent: category.parent ? byId.get(String(category.parent)) : null })));
}

export async function getCategoryBySlug(req: Request, res: Response): Promise<void> {
  const categories = visibleCategories(await Category.find({ isActive: true }).lean());
  const category = categories.find(item => item.slug === req.params.slug);
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  sendSuccess(res, { ...category, parent: category.parent ? categories.find(item => String(item._id) === String(category.parent)) : null });
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
