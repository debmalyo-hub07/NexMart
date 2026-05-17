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

export async function getCategories(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.query.parent !== undefined) {
    filter.parent = req.query.parent === 'null' ? null : req.query.parent;
  }
  const categories = await Category.find({ ...filter, isActive: true })
    .populate('parent', 'name slug _id')
    .sort({ displayOrder: 1, name: 1 });
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
  sendCreated(res, category);
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const data = categorySchema.partial().parse(req.body);
  const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  sendSuccess(res, category, 'Category updated');
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) { sendNotFound(res, 'Category not found'); return; }
  sendSuccess(res, null, 'Category deleted');
}
