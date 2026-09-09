import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { uploadImageBuffer, deleteImageByUrl } from '../services/cloudinary.service';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { parsePagination, parseSortField, generateSlug } from '../utils/helpers';
import { upstashRedis } from '../config/redis';

async function clearFeaturedProductsCache() {
  try {
    await upstashRedis.del('nexmart:products:featured');
  } catch (err) {
    console.error('Redis invalidation failed for featured products:', err);
  }
}

const productSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10),
  richDescription: z.string().optional(),
  category: z.string(),
  subCategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  brand: z.string().optional(),
  specifications: z.record(z.string()).optional(),
  variants: z.array(z.object({
    sku: z.string(),
    attributes: z.record(z.string()).optional(),
    price: z.number().positive(),
    comparePrice: z.number().positive().optional(),
    stock: z.number().int().min(0),
    images: z.array(z.string()).optional(),
  })),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  videoUrl: z.string().url().optional(),
  images: z.array(z.string()).optional(),
});

const ALLOWED_SORT = ['createdAt', 'name', 'ratings.average', 'variants.0.price'];

export async function getProducts(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSortField(req.query.sort as string, ALLOWED_SORT, '-createdAt');

  const filter: Record<string, unknown> = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.brand) filter.brand = new RegExp(req.query.brand as string, 'i');
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.q) {
    const searchRegex = new RegExp(req.query.q as string, 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }
  if (req.query.minPrice || req.query.maxPrice) {
    filter['variants.0.price'] = {};
    if (req.query.minPrice) (filter['variants.0.price'] as Record<string, number>)['$gte'] = parseFloat(req.query.minPrice as string);
    if (req.query.maxPrice) (filter['variants.0.price'] as Record<string, number>)['$lte'] = parseFloat(req.query.maxPrice as string);
  }
  if (req.query.rating) {
    filter['ratings.average'] = { $gte: parseFloat(req.query.rating as string) };
  }

  // Caching featured homepage products (limit=8, featured=true)
  const isHomepageFeatured = req.query.featured === 'true' && limit === 8;
  if (isHomepageFeatured) {
    try {
      const cached = await upstashRedis.get('nexmart:products:featured');
      if (cached) {
        const { products, total } = cached as { products: any[]; total: number };
        sendPaginated(res, products, total, page, limit);
        return;
      }
    } catch (err) {
      console.error('Redis read error for featured products:', err);
    }
  }

  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  if (isHomepageFeatured) {
    try {
      await upstashRedis.set('nexmart:products:featured', { products, total }, { ex: 300 }); // 5 minutes TTL
    } catch (err) {
      console.error('Redis write error for featured products:', err);
    }
  }

  sendPaginated(res, products, total, page, limit);
}

export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.slug);
  const query: Record<string, any> = isObjectId ? { _id: req.params.slug } : { slug: req.params.slug };
  
  // Note: For admin we might want to fetch unpublished products too, but for now we'll fetch all if using ID.
  if (!isObjectId) query.isPublished = true;

  const product = await Product.findOne(query)
    .populate('category', 'name slug')
    .populate('reviews.user', 'name profilePicture')
    .lean();
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  sendSuccess(res, product);
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  
  // Parse stringified fields from multipart/form-data
  if (typeof req.body.variants === 'string') req.body.variants = JSON.parse(req.body.variants);
  if (typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);
  if (typeof req.body.specifications === 'string') req.body.specifications = JSON.parse(req.body.specifications);
  if (typeof req.body.images === 'string') req.body.images = JSON.parse(req.body.images);
  if (typeof req.body.isPublished === 'string') req.body.isPublished = req.body.isPublished === 'true';
  if (typeof req.body.isFeatured === 'string') req.body.isFeatured = req.body.isFeatured === 'true';

  const data = productSchema.parse(req.body);

  const slug = generateSlug(data.name);
  const existing = await Product.findOne({ slug });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const product = await Product.create({
    ...data,
    slug: finalSlug,
    createdBy: userId,
    images: [],
  });

  // Upload any provided images
  if (req.files && Array.isArray(req.files)) {
    const uploads = await Promise.all(
      (req.files as Express.Multer.File[]).map((f) =>
        uploadImageBuffer(f.buffer, 'products')
      )
    );
    product.images = uploads.map((u) => u.url);
    await product.save();
  }

  await clearFeaturedProductsCache();

  sendCreated(res, product, 'Product created');
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  
  // Parse stringified fields
  if (typeof req.body.variants === 'string') req.body.variants = JSON.parse(req.body.variants);
  if (typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);
  if (typeof req.body.specifications === 'string') req.body.specifications = JSON.parse(req.body.specifications);
  if (typeof req.body.images === 'string') req.body.images = JSON.parse(req.body.images);
  if (typeof req.body.isPublished === 'string') req.body.isPublished = req.body.isPublished === 'true';
  if (typeof req.body.isFeatured === 'string') req.body.isFeatured = req.body.isFeatured === 'true';

  const data = productSchema.partial().parse(req.body);

  const product = await Product.findByIdAndUpdate(id, data, { new: true });
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  await clearFeaturedProductsCache();
  sendSuccess(res, product, 'Product updated');
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) { sendNotFound(res, 'Product not found'); return; }

  // B11: destroy the product's CDN images too — they used to be orphaned in
  // Cloudinary forever. Best-effort per image: a CDN error never blocks the
  // DB delete that already happened.
  for (const url of product.images || []) {
    try {
      await deleteImageByUrl(url);
    } catch (err) {
      console.error(`Cloudinary image cleanup failed for ${url}:`, err instanceof Error ? err.message : err);
    }
  }

  await clearFeaturedProductsCache();
  sendSuccess(res, null, 'Product deleted');
}

export async function uploadProductImages(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!req.files || !(req.files as Express.Multer.File[]).length) {
    sendNotFound(res, 'No images provided'); return;
  }

  const uploads = await Promise.all(
    (req.files as Express.Multer.File[]).map((f) => uploadImageBuffer(f.buffer, 'products'))
  );
  const urls = uploads.map((u) => u.url);

  const product = await Product.findByIdAndUpdate(
    id,
    { $push: { images: { $each: urls } } },
    { new: true }
  );
  sendSuccess(res, { images: product?.images }, 'Images uploaded');
}

// ── Product Reviews ───────────────────────────────────────────
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().max(2000).optional(),
});

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const product = await Product.findById(req.params.id)
    .select('reviews')
    .populate('reviews.user', 'name profilePicture');

  if (!product) { sendNotFound(res, 'Product not found'); return; }

  // Newest first, plain array (frontend expects data.data to be a list)
  const reviews = [...product.reviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  sendSuccess(res, reviews);
}

export async function addProductReview(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { rating, title, body } = reviewSchema.parse(req.body);

  const product = await Product.findById(req.params.id);
  if (!product) { sendNotFound(res, 'Product not found'); return; }

  const alreadyReviewed = product.reviews.some((r) => r.user.toString() === userId);
  if (alreadyReviewed) { sendBadRequest(res, 'You have already reviewed this product'); return; }

  // Verified-purchase badge: this customer has a delivered order containing this product
  const isVerifiedPurchase = !!(await Order.exists({
    customer: userId,
    'items.product': product._id,
    orderStatus: 'delivered',
  }));

  product.reviews.push({
    user: new mongoose.Types.ObjectId(userId),
    rating,
    title,
    body,
    isVerifiedPurchase,
  } as never);
  product.ratings.count = product.reviews.length;
  product.ratings.average =
    product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.ratings.count;

  await product.save();

  const created = product.reviews[product.reviews.length - 1];
  sendCreated(res, created, 'Review submitted');
}
