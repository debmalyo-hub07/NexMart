import { Request, Response } from 'express';
import { z } from 'zod';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { sendSuccess, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { cartMergeSchema } from '../utils/validation';
import mongoose from 'mongoose';
import { cartSnapshot, resolveListingOffer } from '../services/cartOffer.service';

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
  const cart = await Cart.findOne(filter);
  // No subtotal field is promised here: the Cart model has none, and populated
  // carts never carried one — the empty-cart default used to advertise a
  // phantom `subtotal: 0` (B10).
  sendSuccess(res, await cartSnapshot(cart));
}

export async function addToCart(req: Request, res: Response): Promise<void> {
  const { productId, variant, quantity = 1, listingId } = z.object({
    productId: z.string(),
    variant: z.string(),
    quantity: z.number().int().positive().max(10).default(1),
    listingId: z.string().optional(),
  }).parse(req.body);

  const product = await Product.findById(productId);
  if (!product?.isPublished) { sendNotFound(res, 'Product is no longer available'); return; }
  if (product.isDemo) { sendBadRequest(res, 'This sample product is for browsing only and cannot be purchased.'); return; }

  const variantData = product.variants.find((v) => v.sku === variant);
  if (!variantData) { sendBadRequest(res, 'Invalid variant SKU'); return; }

  let resolvedPrice = variantData.price;
  let resolvedSeller: mongoose.Types.ObjectId | undefined;
  let availableStock = variantData.stock;
  if (listingId) {
    const offer = await resolveListingOffer(String(product._id), variant, listingId);
    if (!offer) { sendBadRequest(res, 'Offer is no longer available for this product option'); return; }
    if (offer.stock < quantity) { sendBadRequest(res, 'Insufficient stock for this offer'); return; }
    resolvedPrice = offer.price;
    resolvedSeller = offer.seller;
    availableStock = offer.stock;
  } else if (variantData.stock < quantity) { sendBadRequest(res, 'Insufficient stock'); return; }

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
    (item) => item.product.toString() === productId && item.variant === variant && String(item.listing || '') === String(listingId || '')
  );

  const otherQuantity = listingId ? cart.items.filter(item => item !== existingItem && String(item.listing) === listingId).reduce((sum, item) => sum + item.quantity, 0) : 0;
  const maxStock = Math.max(0, Math.min(10, availableStock - otherQuantity));
  if ((existingItem?.quantity ?? 0) + quantity > maxStock) { sendBadRequest(res, `Only ${maxStock} of this option can be added to your cart.`); return; }
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.price = resolvedPrice;
  } else {
    cart.items.push({ product: product._id, variant, quantity, price: resolvedPrice, listing: listingId ? new mongoose.Types.ObjectId(listingId) : undefined, seller: resolvedSeller });
  }

  await cart.save();
  sendSuccess(res, await cartSnapshot(cart), 'Added to cart');
}

export async function updateCartItem(req: Request, res: Response): Promise<void> {
  const { quantity } = z.object({ quantity: z.number().int().positive().max(10) }).parse(req.body);
  const filter = getCartFilter(req);

  const cart = await Cart.findOne({ ...filter, 'items._id': req.params.itemId });
  const item = cart?.items.find(line => String(line._id) === req.params.itemId);
  if (!cart || !item) { sendNotFound(res, 'Cart item not found'); return; }
  const product = await Product.findById(item.product);
  const variant = product?.variants.find(option => option.sku === item.variant);
  if (!product?.isPublished || product.isDemo || !variant) { sendBadRequest(res, 'This item is no longer available. Remove it from your cart.'); return; }
  const offer = item.listing ? await resolveListingOffer(String(product._id), item.variant, String(item.listing)) : undefined;
  if (item.listing && !offer) { sendBadRequest(res, 'This seller offer is no longer available. Remove it from your cart.'); return; }
  const others = item.listing ? cart.items.filter(line => line !== item && String(line.listing) === String(item.listing)).reduce((sum, line) => sum + line.quantity, 0) : 0;
  const stock = Math.max(0, (offer?.stock ?? variant.stock) - others);
  if (quantity > stock) { sendBadRequest(res, `Only ${stock} of this option are available.`); return; }
  item.quantity = quantity;
  item.price = offer?.price ?? variant.price;
  await cart.save();
  sendSuccess(res, await cartSnapshot(cart), 'Cart updated');
}

export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $pull: { items: { _id: req.params.itemId } }, $inc: { __v: 1 } },
    { new: true }
  );
  if (!cart) { sendNotFound(res, 'Cart item not found'); return; }
  sendSuccess(res, await cartSnapshot(cart), 'Item removed');
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
        if (!product?.isPublished || product.isDemo || !option) { adjustments.push('An unavailable guest-cart item could not be added.'); continue; }
        const listingId = item.listing ? String(item.listing) : undefined;
        const offer = listingId ? await resolveListingOffer(String(product._id), item.variant, listingId, session) : undefined;
        if (listingId && !offer) { adjustments.push('An unavailable seller offer could not be added.'); continue; }
        const existing = cart.items.find(line => String(line.product) === String(item.product) && line.variant === item.variant && String(line.listing || '') === String(listingId || ''));
        const others = listingId ? cart.items.filter(line => line !== existing && String(line.listing) === listingId).reduce((sum, line) => sum + line.quantity, 0) : 0;
        const requested = (existing?.quantity ?? 0) + item.quantity;
        const quantity = Math.max(0, Math.min(requested, (offer?.stock ?? option.stock) - others, 10));
        if (!quantity) { adjustments.push('An unavailable guest-cart item could not be added.'); continue; }
        if (quantity < requested) adjustments.push(`The quantity of ${product.name} was adjusted to ${quantity} to match availability.`);
        if (existing) { existing.quantity = quantity; existing.price = offer?.price ?? option.price; }
        else cart.items.push({ product: product._id, variant: item.variant, quantity, price: offer?.price ?? option.price, listing: listingId ? new mongoose.Types.ObjectId(listingId) : undefined, seller: offer?.seller });
      }
      await cart.save({ session });
      if (guest) await Cart.deleteOne({ _id: guest._id }, { session });
    });
    const cart = await Cart.findOne({ user: userId });
    sendSuccess(res, { ...(await cartSnapshot(cart)), adjustments }, 'Cart ready');
  } finally { await session.endSession(); }
}
