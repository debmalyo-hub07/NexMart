import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Product } from '../models/Product';
import { IProduct } from '../types';
import { sendPaginated } from '../utils/response';
import { parsePagination, parseSortField } from '../utils/helpers';

const ALLOWED_SORT = ['createdAt', 'ratings.average', 'name', 'variants.0.price'];

export async function searchProducts(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const sort = parseSortField(req.query.sort as string, ALLOWED_SORT, '-createdAt');
  const {
    q, category, brand, minPrice, maxPrice, rating, inStock,
  } = req.query as Record<string, string>;

  const filter: FilterQuery<IProduct> = { isPublished: true };

  // Full-text search
  if (q) {
    filter.$text = { $search: q };
  }

  if (category) filter.category = category;
  if (brand) filter.brand = new RegExp(brand, 'i');

  if (minPrice || maxPrice) {
    filter['variants.0.price'] = {};
    if (minPrice) filter['variants.0.price'].$gte = parseFloat(minPrice);
    if (maxPrice) filter['variants.0.price'].$lte = parseFloat(maxPrice);
  }

  if (rating) {
    filter['ratings.average'] = { $gte: parseFloat(rating) };
  }

  if (inStock === 'true') {
    filter['variants.0.stock'] = { $gt: 0 };
  }

  // Build sort
  const sortObj: Record<string, 1 | -1 | { $meta: 'textScore' }> = {};
  if (q) sortObj.score = { $meta: 'textScore' };
  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  const sortDir: 1 | -1 = sort.startsWith('-') ? -1 : 1;
  sortObj[sortField] = sortDir;

  // Projection (only needed for text score)
  const projection: Record<string, { $meta: 'textScore' }> | undefined =
    q ? { score: { $meta: 'textScore' } } : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = await Product.find(filter, projection as any)
    .populate('category', 'name slug')
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Product.countDocuments(filter);

  sendPaginated(res, products, total, page, limit);
}
