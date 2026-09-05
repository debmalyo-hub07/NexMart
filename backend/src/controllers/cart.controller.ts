import { Request, Response } from 'express';
import { z } from 'zod';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { sendSuccess, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';

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
  const cart = await Cart.findOne(filter).populate('items.product', 'name images slug variants');
  sendSuccess(res, cart || { items: [], subtotal: 0 });
}

export async function addToCart(req: Request, res: Response): Promise<void> {
  const { productId, variant, quantity = 1 } = z.object({
    productId: z.string(),
    variant: z.string(),
    quantity: z.number().int().positive().default(1),
  }).parse(req.body);

  const product = await Product.findById(productId);
  if (!product) { sendNotFound(res, 'Product not found'); return; }

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
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ product: product._id, variant, quantity, price: variantData.price });
  }

  await cart.save();
  const populated = await cart.populate('items.product', 'name images slug variants');
  sendSuccess(res, populated, 'Added to cart');
}

export async function updateCartItem(req: Request, res: Response): Promise<void> {
  const { quantity } = z.object({ quantity: z.number().int().positive() }).parse(req.body);
  const filter = getCartFilter(req);

  const cart = await Cart.findOneAndUpdate(
    { ...filter, 'items._id': req.params.itemId },
    { $set: { 'items.$.quantity': quantity } },
    { new: true }
  ).populate('items.product', 'name images slug variants');

  if (!cart) { sendNotFound(res, 'Cart item not found'); return; }
  sendSuccess(res, cart, 'Cart updated');
}

export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $pull: { items: { _id: req.params.itemId } } },
    { new: true }
  ).populate('items.product', 'name images slug variants');
  if (!cart) { sendNotFound(res, 'Cart item not found'); return; }
  sendSuccess(res, cart, 'Item removed');
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  await Cart.findOneAndUpdate(filter, { $set: { items: [] } });
  sendSuccess(res, null, 'Cart cleared');
}

const mergeItemsSchema = z.array(z.object({
  product: z.string(),
  variant: z.string(),
  quantity: z.number().int().positive().max(10),
}));

// POST /cart/merge — merge the guest (localStorage) cart into the account
// cart after login. Re-validates price/stock from the DB like addToCart.
export async function mergeGuestCart(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const items = mergeItemsSchema.parse(req.body);

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = new Cart({ user: userId, items: [] });

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) continue; // silently skip deleted products on merge
    const variantData = product.variants.find((v) => v.sku === item.variant);
    if (!variantData || variantData.stock < item.quantity) continue;

    const existing = cart.items.find(
      (i) => i.product.toString() === item.product && i.variant === item.variant
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, 10);
    } else {
      cart.items.push({ product: product._id, variant: item.variant, quantity: item.quantity, price: variantData.price });
    }
  }

  await cart.save();
  const populated = await cart.populate('items.product', 'name images slug variants');
  sendSuccess(res, populated, 'Cart merged');
}
