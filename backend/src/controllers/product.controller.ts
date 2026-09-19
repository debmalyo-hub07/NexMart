import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { uploadImageBuffer, deleteImageByUrl } from '../services/cloudinary.service';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { generateSlug } from '../utils/helpers';
import { upstashRedis } from '../config/redis';
import { queryCatalog } from '../services/catalog.service';
import { publicProductVisibility, visibleCategories } from '../utils/categoryVisibility';

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

export async function getProducts(req: Request, res: Response): Promise<void> {
  const result = await queryCatalog(req.query);
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json(result);
}

export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.slug);
  const categories = visibleCategories(await Category.find({ isActive: true }).select('_id parent').lean());
  const query = { ...(isObjectId ? { _id: req.params.slug } : { slug: req.params.slug }), ...publicProductVisibility(categories) };
  const product = await Product.findOne(query).select('-reviews -createdBy').populate('category', 'name slug').lean();
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  sendSuccess(res, product);
}

// IDs never bypass publication. Editing uses an explicitly guarded route.
export async function getProductForAdmin(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Product not found'); return; }
  const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
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
    images: data.images ?? [],
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

  const product = await Product.findById(id);
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  product.set(data);
  await product.save();
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
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).refine((value) => !/[<>]/.test(value), 'Reviews must be plain text').optional(),
  body: z.string().trim().max(2000).refine((value) => !/[<>]/.test(value), 'Reviews must be plain text').optional(),
});

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const product = await Product.findOne({ _id: req.params.id, isPublished: true })
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

  const product = await Product.findOne({ _id: req.params.id, isPublished: true });
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  if (product.isDemo) { sendBadRequest(res, 'Sample products cannot receive customer reviews.'); return; }

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
