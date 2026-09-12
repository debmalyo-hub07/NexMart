import { Request, Response } from 'express';
import { z } from 'zod';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { sendSuccess, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { cartMergeSchema } from '../utils/validation';
import mongoose from 'mongoose';

function getCartFilter(req: Request): Record<string, unknown> {
  const user = (req as AuthenticatedRequest).user;
  if (user) return { user: user.userId };
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) return { sessionId };
  // No authenticated user AND no guest session id → match NO cart.
  // Returning {} here would make findOne/updateOne operate on an arbitrary user's cart.
  return { _id: null };
}

export async function getCart(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  const cart = await Cart.findOne(filter).populate('items.product', 'name images slug variants isPublished');
  // No subtotal field is promised here: the Cart model has none, and populated
  // carts never carried one — the empty-cart default used to advertise a
  // phantom `subtotal: 0` (B10).
  sendSuccess(res, cart || { items: [] });
}

export async function addToCart(req: Request, res: Response): Promise<void> {
  const { productId, variant, quantity = 1 } = z.object({
    productId: z.string(),
    variant: z.string(),
    quantity: z.number().int().positive().max(10).default(1),
  }).parse(req.body);

  const product = await Product.findById(productId);
  if (!product?.isPublished) { sendNotFound(res, 'Product is no longer available'); return; }

  const variantData = product.variants.find((v) => v.sku === variant);
  if (!variantData) { sendBadRequest(res, 'Invalid variant SKU'); return; }
  if (variantData.stock < quantity) { sendBadRequest(res, 'Insufficient stock'); return; }

  const user = (req as AuthenticatedRequest).user;
  const sessionId = req.headers['x-session-id'] as string;
  if (!user && !sessionId) {
    sendBadRequest(res, 'No cart session. Please refresh and try again.');
    return;
  }

  const filter = getCartFilter(req);
  let cart = await Cart.findOne(filter);

  if (!cart) {
    cart = new Cart({
      ...(user ? { user: user.userId } : { sessionId }),
      items: [],
    });
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId && item.variant === variant
  );

  if (existingItem) {
    if (existingItem.quantity + quantity > Math.min(10, variantData.stock)) { sendBadRequest(res, `Only ${Math.min(10, variantData.stock)} of this option can be added to your cart.`); return; }
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ product: product._id, variant, quantity, price: variantData.price });
  }

  await cart.save();
  const populated = await cart.populate('items.product', 'name images slug variants isPublished');
  sendSuccess(res, populated, 'Added to cart');
}

export async function updateCartItem(req: Request, res: Response): Promise<void> {
  const { quantity } = z.object({ quantity: z.number().int().positive().max(10) }).parse(req.body);
  const filter = getCartFilter(req);

  const cart = await Cart.findOne({ ...filter, 'items._id': req.params.itemId });
  const item = cart?.items.find(line => String(line._id) === req.params.itemId);
  if (!cart || !item) { sendNotFound(res, 'Cart item not found'); return; }
  const product = await Product.findById(item.product);
  const variant = product?.variants.find(option => option.sku === item.variant);
  if (!product?.isPublished || !variant) { sendBadRequest(res, 'This item is no longer available. Remove it from your cart.'); return; }
  if (quantity > variant.stock) { sendBadRequest(res, `Only ${variant.stock} of this option are available.`); return; }
  item.quantity = quantity;
  await cart.save();
  sendSuccess(res, await cart.populate('items.product', 'name images slug variants isPublished'), 'Cart updated');
}

export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $pull: { items: { _id: req.params.itemId } }, $inc: { __v: 1 } },
    { new: true }
  ).populate('items.product', 'name images slug variants isPublished');
  if (!cart) { sendNotFound(res, 'Cart item not found'); return; }
  sendSuccess(res, cart, 'Item removed');
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  await Cart.findOneAndUpdate(filter, { $set: { items: [] }, $inc: { __v: 1 } });
  sendSuccess(res, null, 'Cart cleared');
}

// POST /cart/merge — merge the guest (localStorage) cart into the account
// cart after login. Re-validates price/stock from the DB like addToCart.
// Body shape: { items: [...] } — exactly what authStore.ts sends (B1 fix: the
// old bare-array schema made every login merge fail validation).
export async function mergeGuestCart(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const input = cartMergeSchema.parse(req.body);
  const sessionId = req.headers['x-session-id'];
  const session = await mongoose.startSession();
  let adjustments: string[] = [];
  try {
    await session.withTransaction(async () => {
      adjustments = [];
      const guest = input.fromSession && typeof sessionId === 'string' ? await Cart.findOne({ sessionId, user: { $exists: false } }).session(session) : null;
      const items = input.fromSession ? guest?.items ?? [] : input.items;
      let cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart) cart = new Cart({ user: userId, items: [] });
      for (const item of items) {
        const product = await Product.findById(item.product).session(session);
        const option = product?.variants.find(variant => variant.sku === item.variant);
        if (!product?.isPublished || !option || !option.stock) { adjustments.push('An unavailable guest-cart item could not be added.'); continue; }
        const existing = cart.items.find(line => String(line.product) === String(item.product) && line.variant === item.variant);
        const requested = (existing?.quantity ?? 0) + item.quantity;
        const quantity = Math.min(requested, option.stock, 10);
        if (quantity < requested) adjustments.push(`The quantity of ${product.name} was adjusted to ${quantity} to match availability.`);
        if (existing) existing.quantity = quantity;
        else cart.items.push({ product: product._id, variant: item.variant, quantity, price: option.price });
      }
      await cart.save({ session });
      if (guest) await Cart.deleteOne({ _id: guest._id }, { session });
    });
    const cart = await Cart.findOne({ user: userId }).populate('items.product', 'name images slug variants isPublished');
    sendSuccess(res, { ...cart?.toJSON(), adjustments }, 'Cart ready');
  } finally { await session.endSession(); }
}
