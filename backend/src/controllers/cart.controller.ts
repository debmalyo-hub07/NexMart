import { Request, Response } from 'express';
import { z } from 'zod';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { sendSuccess, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';

function getCartFilter(req: Request): Record<string, string | undefined> {
  const user = (req as AuthenticatedRequest).user;
  if (user) return { user: user.userId };
  const sessionId = req.headers['x-session-id'] as string;
  return sessionId ? { sessionId } : {};
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

  const filter = getCartFilter(req);
  let cart = await Cart.findOne(filter);

  if (!cart) {
    const user = (req as AuthenticatedRequest).user;
    cart = new Cart({
      ...(user ? { user: user.userId } : { sessionId: req.headers['x-session-id'] }),
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
  );
  sendSuccess(res, cart, 'Item removed');
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  await Cart.findOneAndUpdate(filter, { $set: { items: [] } });
  sendSuccess(res, null, 'Cart cleared');
}
