import { Request, Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { sendSuccess, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';

async function getWishlistDoc(userId: string) {
  let doc = await Wishlist.findOne({ user: userId });
  if (!doc) doc = await Wishlist.create({ user: userId, products: [] });
  return doc;
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const doc = await getWishlistDoc(userId);
  const products = await Product.find({ _id: { $in: doc.products }, isPublished: true })
    .select('name slug images variants ratings');
  sendSuccess(res, { productIds: doc.products.map(String), products });
}

export async function addToWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const productId = req.params.productId;

  const exists = await Product.exists({ _id: productId, isPublished: true });
  if (!exists) { sendBadRequest(res, 'Product not found'); return; }

  const doc = await getWishlistDoc(userId);
  if (!doc.products.some((p) => p.toString() === productId)) {
    doc.products.push(productId as never);
    await doc.save();
  }
  sendSuccess(res, { productIds: doc.products.map(String) }, 'Added to wishlist');
}

export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const doc = await Wishlist.findOne({ user: userId });
  if (doc) {
    doc.products = doc.products.filter((p) => p.toString() !== req.params.productId);
    await doc.save();
  }
  sendSuccess(res, { productIds: doc ? doc.products.map(String) : [] }, 'Removed from wishlist');
}
