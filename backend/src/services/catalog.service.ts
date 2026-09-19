import { type PipelineStage, Types } from 'mongoose';
import { z } from 'zod';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { normalizeSearch, tokenPattern } from '../utils/catalogSearch';
import { publicProductVisibility, visibleCategories } from '../utils/categoryVisibility';

const textInput = z.string().trim().max(200).optional();
const numeric = (max: number) => z.preprocess(value => value === '' || value === undefined ? undefined : value, z.coerce.number().finite().min(0).max(max).optional());
const schema = z.object({
  q: textInput, category: textInput, brand: z.string().trim().max(600).optional(),
  minPrice: numeric(1_000_000_000), maxPrice: numeric(1_000_000_000), rating: numeric(5),
  inStock: z.enum(['true', 'false']).optional(), featured: z.enum(['true', 'false']).optional(),
  sort: textInput, page: z.string().optional(), limit: z.string().optional(),
}).refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.maxPrice >= value.minPrice, { message: 'Maximum price must be at least the minimum price.', path: ['maxPrice'] });

export function parseCatalogInput(query: Record<string, unknown>) {
  const input = schema.parse(query);
  const list = (value?: string) => [...new Set((value ?? '').split(',').map(part => part.trim()).filter(Boolean))].slice(0, 12);
  const page = Math.min(10000, Math.max(1, Number.isSafeInteger(Number(input.page)) ? Number(input.page) : 1));
  const limit = Math.min(48, Math.max(1, Number.isSafeInteger(Number(input.limit)) ? Number(input.limit) : 12));
  const allowed = ['-createdAt', 'createdAt', 'name', '-name', 'price', '-price', 'variants.0.price', '-variants.0.price', '-ratings.average', 'ratings.average'];
  return { ...input, q: normalizeSearch(input.q ?? ''), categories: list(input.category), brands: list(input.brand), page, limit, sort: allowed.includes(input.sort ?? '') ? input.sort! : '' };
}

type Input = ReturnType<typeof parseCatalogInput>;
type Taxon = { _id: Types.ObjectId; name: string; slug: string; parent?: Types.ObjectId | null; description?: string; image?: string; displayOrder: number };
export type CategoryGroup = { _id: { category: Types.ObjectId; subCategory?: string }; count: number; image?: string; price?: number };
type FacetResult = { products: Record<string, unknown>[]; total: { count: number }[]; brands: { _id: string; count: number }[]; categories: CategoryGroup[]; prices: { min: number; max: number }[] };

export function descendantIds(categories: Taxon[], values: string[]): string[] {
  const selected = new Set(categories.filter(category => values.includes(category.slug) || values.includes(String(category._id))).map(category => String(category._id)));
  let size = -1;
  while (size !== selected.size) {
    size = selected.size;
    for (const category of categories) if (category.parent && selected.has(String(category.parent))) selected.add(String(category._id));
  }
  return [...selected];
}

/** Counts each product once per ancestor, even when both category fields name it.
 *  $group output order is unspecified, so groups are folded in a stable order
 *  (category id, then subcategory id) — otherwise the image/price a parent
 *  inherits could differ between requests, which desynced SSR HTML from the
 *  client tree and threw hydration errors. */
export function categorySummaries(categories: Taxon[], groups: CategoryGroup[]) {
  const byId = new Map(categories.map(category => [String(category._id), category]));
  const summaries = new Map<string, { count: number; image?: string; price?: number }>();
  const ordered = [...groups].sort((a, b) =>
    String(a._id.category).localeCompare(String(b._id.category)) ||
    (a._id.subCategory ?? '').localeCompare(b._id.subCategory ?? ''));
  for (const group of ordered) {
    const visited = new Set<string>();
    for (const start of [group._id.category, group._id.subCategory]) {
      let current = start ? byId.get(String(start)) : undefined;
      while (current && !visited.has(String(current._id))) {
        const id = String(current._id);
        visited.add(id);
        const previous = summaries.get(id);
        summaries.set(id, { count: (previous?.count ?? 0) + group.count, image: previous?.image || group.image, price: Math.min(previous?.price ?? Infinity, group.price ?? Infinity) });
        current = current.parent ? byId.get(String(current.parent)) : undefined;
      }
    }
  }
  return categories.map(category => ({ ...category, productCount: summaries.get(String(category._id))?.count ?? 0, image: category.image || summaries.get(String(category._id))?.image, fromPrice: summaries.get(String(category._id))?.price }));
}

/** Group image uses $max, not $first: $first follows arbitrary document order,
 *  so the category cover image could differ between two identical requests —
 *  which desynced the server-rendered homepage HTML from the client tree and
 *  threw hydration errors. $max skips products without images and is stable. */
export const categoryGroupStage: PipelineStage.Group = { $group: {
  _id: { category: '$category', subCategory: '$subCategory' }, count: { $sum: 1 },
  image: { $max: { $arrayElemAt: ['$images', 0] } }, price: { $min: { $min: '$variants.price' } },
} };

function categoryMatch(ids: string[]) {
  return { $or: [{ category: { $in: ids.map(id => new Types.ObjectId(id)) } }, { subCategory: { $in: ids } }] };
}

function variantStages(input: Input): PipelineStage[] {
  const conditions: Record<string, unknown>[] = [{ $gte: ['$$variant.price', 0] }];
  if (input.inStock === 'true') conditions.push({ $gt: ['$$variant.stock', 0] });
  if (input.minPrice !== undefined) conditions.push({ $gte: ['$$variant.price', input.minPrice] });
  if (input.maxPrice !== undefined) conditions.push({ $lte: ['$$variant.price', input.maxPrice] });
  return [
    { $set: { _eligible: { $filter: { input: '$variants', as: 'variant', cond: { $and: conditions } } } } },
    { $match: { '_eligible.0': { $exists: true } } },
    { $set: { _available: { $filter: { input: '$_eligible', as: 'variant', cond: { $gt: ['$$variant.stock', 0] } } } } },
    { $set: { _choices: { $cond: [{ $gt: [{ $size: '$_available' }, 0] }, '$_available', '$_eligible'] } } },
    { $set: { _price: { $min: '$_choices.price' } } },
    { $set: { _chosen: { $arrayElemAt: [{ $filter: { input: '$_choices', as: 'variant', cond: { $eq: ['$$variant.price', '$_price'] } } }, 0] } } },
    { $set: { catalog: { price: '$_price', maxPrice: { $max: '$_choices.price' }, variantSku: '$_chosen.sku', inStock: { $gt: [{ $size: '$_available' }, 0] } } } },
  ];
}

function buildPipeline(input: Input, categories: Taxon[], approximate = false): PipelineStage[] {
  const pipeline: PipelineStage[] = [{ $match: publicProductVisibility(categories) }];
  if (input.inStock === 'true') pipeline.push({ $match: { isDemo: { $ne: true } } });
  if (input.featured === 'true') pipeline.push({ $match: { isFeatured: true } });
  if (input.rating !== undefined) pipeline.push({ $match: { 'ratings.average': { $gte: input.rating }, 'ratings.count': { $gt: 0 } } });
  if (input.q) {
    pipeline.push({ $set: { _searchText: { $ifNull: ['$searchText', { $toLower: { $concat: ['$name', ' ', { $ifNull: ['$brand', ''] }, ' ', '$description'] } }] } } });
    for (const token of new Set(input.q.split(' ').filter(Boolean))) {
      const pattern = tokenPattern(token, approximate);
      const exactCategories = categories.filter(category => [normalizeSearch(category.name), normalizeSearch(category.slug)].includes(token));
      const matchingCategories = exactCategories.length ? exactCategories : categories.filter(category => new RegExp(pattern).test(normalizeSearch(`${category.name} ${category.slug}`)));
      const categoryIds = descendantIds(categories, matchingCategories.map(category => category.slug));
      pipeline.push({ $match: exactCategories.length ? categoryMatch(categoryIds) : { $or: [{ _searchText: { $regex: pattern } }, ...(categoryIds.length ? [categoryMatch(categoryIds)] : [])] } });
    }
    pipeline.push({ $set: { _score: { $add: [
      { $cond: [{ $eq: [{ $toLower: '$name' }, input.q] }, 100, 0] },
      { $cond: [{ $regexMatch: { input: { $toLower: '$name' }, regex: tokenPattern(input.q.split(' ')[0]) } }, 20, 0] },
      { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$brand', ''] } }, input.q] }, 10, 0] },
    ] } } });
  }
  const categoryStages: PipelineStage[] = input.categories.length ? [{ $match: categoryMatch(descendantIds(categories, input.categories)) }] : [];
  const brandStages: PipelineStage[] = input.brands.length ? [{ $match: { brand: { $in: input.brands.map(brand => new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } } }] : [];
  const variants = variantStages(input);
  const filters = [...categoryStages, ...brandStages, ...variants];
  const sortKey = input.sort.replace(/^-/, '').replace('variants.0.price', 'price');
  const sort: Record<string, 1 | -1> = input.sort ? { [sortKey === 'price' ? '_price' : sortKey]: input.sort.startsWith('-') ? -1 : 1, _id: 1 } : input.q ? { _score: -1, createdAt: -1, _id: 1 } : { createdAt: -1, _id: 1 };
  pipeline.push({ $facet: {
    products: [...filters, { $sort: sort }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }, { $project: {
      name: 1, slug: 1, description: { $substrCP: ['$description', 0, 260] }, category: 1, subCategory: 1,
      images: { $slice: ['$images', 2] }, variants: 1, tags: 1, brand: 1, specifications: 1, ratings: 1,
      isPublished: 1, isFeatured: 1, isDemo: 1, createdAt: 1, catalog: 1,
    } }],
    total: [...filters, { $count: 'count' }],
    // Disjunctive facets: selecting one brand does not erase the other choices.
    brands: [...categoryStages, ...variants, { $match: { brand: { $nin: [null, ''] } } }, { $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 60 }],
    categories: [...brandStages, ...variants, categoryGroupStage],
    prices: [...categoryStages, ...brandStages, { $unwind: '$variants' }, ...(input.inStock === 'true' ? [{ $match: { 'variants.stock': { $gt: 0 } } }] : []), { $group: { _id: null, min: { $min: '$variants.price' }, max: { $max: '$variants.price' } } }],
  } } as PipelineStage);
  return pipeline;
}

export async function queryCatalog(query: Record<string, unknown>) {
  const input = parseCatalogInput(query);
  const categories = visibleCategories(await Category.find({ isActive: true }).select('name slug parent displayOrder').lean<Taxon[]>());
  let result = (await Product.aggregate<FacetResult>(buildPipeline(input, categories)).option({ maxTimeMS: 5000 }))[0];
  let approximate = false;
  if (!result.total.length && input.q.split(' ').some(token => /^[a-z0-9]{4,24}$/.test(token))) {
    const nearby = (await Product.aggregate<FacetResult>(buildPipeline(input, categories, true)).option({ maxTimeMS: 5000 }))[0];
    if (nearby.total.length) { result = nearby; approximate = true; }
  }
  const byId = new Map(categories.map(category => [String(category._id), category]));
  const total = result.total[0]?.count ?? 0;
  return {
    success: true, message: 'Products loaded',
    data: result.products.map(product => ({ ...product, category: byId.get(String(product.category)) })),
    meta: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
    facets: {
      brands: result.brands.map(brand => ({ value: brand._id, count: brand.count })),
      categories: categorySummaries(categories, result.categories).map(category => ({ value: category.slug, count: category.productCount })),
      price: result.prices[0] ? { min: result.prices[0].min, max: result.prices[0].max } : null,
    },
    search: { query: input.q, mode: approximate ? 'approximate' : 'exact' },
  };
}
