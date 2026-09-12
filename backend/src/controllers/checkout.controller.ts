import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';
import type { AuthenticatedRequest, IOrder } from '../types';
import { createRazorpayOrder, fetchOrderPayments } from '../services/razorpay.service';
import { recordCapturedPayment } from '../services/orderPayment.service';
import { generateOrderId, verifyRazorpaySignature } from '../utils/helpers';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { emitNewOrder } from '../config/socket';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product');
export const checkoutSchema = z.object({
  checkoutId: z.string().uuid().optional(),
  items: z.array(z.object({ product: objectId, variant: z.string().min(1).max(120), quantity: z.number().int().min(1).max(10), expectedPrice: z.number().finite().nonnegative().optional() })).min(1, 'Your cart is empty').max(50)
    .refine(items => new Set(items.map(item => `${item.product.toLowerCase()}:${item.variant}`)).size === items.length, 'Combine duplicate product options in your cart'),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2, 'Enter the recipient’s full name').max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    addressLine1: z.string().trim().min(5, 'Enter a complete street address').max(250),
    addressLine2: z.string().trim().max(250).optional(),
    city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100),
    pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'), country: z.literal('India').default('India'),
  }),
  paymentMethod: z.enum(['online', 'cod']),
  expectedTotal: z.number().finite().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

class CheckoutError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) { super(message); }
}
const paise = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
function checkoutData(order: IOrder) {
  return { orderId: String(order._id), humanOrderId: order.orderId, razorpayOrderId: order.razorpayOrderId, total: order.total, currency: 'INR', keyId: order.paymentMethod === 'online' ? env.RAZORPAY_KEY_ID : undefined, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus };
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const input = checkoutSchema.parse(req.body);
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, checkoutId: undefined })).digest('hex');
  const saved = () => Order.findOne({ customer: userId, checkoutId: input.checkoutId }).select('+checkoutFingerprint');
  const assertSame = (order: IOrder) => {
    if (order.checkoutFingerprint !== fingerprint) throw new CheckoutError('This checkout was already saved with different details. Open your orders to review it.', 'CHECKOUT_CONFLICT');
  };
  let session: mongoose.ClientSession | undefined;
  let created = false;
  let result: IOrder | undefined;
  try {
    if (input.checkoutId) {
      const existing = await saved();
      if (existing) { assertSame(existing); sendSuccess(res, checkoutData(existing), 'Existing order recovered'); return; }
    }
    session = await mongoose.startSession();
    let razorpayOrderId: string | undefined;
    const humanOrderId = generateOrderId();
    await session.withTransaction(async () => {
      if (input.checkoutId) {
        const existing = await saved().session(session!);
        if (existing) { assertSame(existing); result = existing; created = false; return; }
      }
      let subtotalPaise = 0;
      const validatedItems = [];
      for (const item of input.items) {
        const product = await Product.findById(item.product).session(session!);
        const variant = product?.variants.find(option => option.sku === item.variant);
        if (!product?.isPublished || !variant) throw new CheckoutError('An item or option is no longer available. Review your cart before ordering.', 'ITEM_UNAVAILABLE');
        if (variant.stock < item.quantity) throw new CheckoutError(`Stock changed for ${product.name}. Review your cart before ordering.`, 'STOCK_CHANGED');
        if (item.expectedPrice !== undefined && paise(item.expectedPrice) !== paise(variant.price)) throw new CheckoutError('A product price changed. Review the updated cart before ordering.', 'PRICE_CHANGED');
        const totalPrice = paise(variant.price) * item.quantity;
        subtotalPaise += totalPrice;
        validatedItems.push({ product: product._id, name: product.name, image: variant.images?.[0] || product.images?.[0], variant: item.variant, quantity: item.quantity, unitPrice: paise(variant.price) / 100, totalPrice: totalPrice / 100 });
      }
      const shippingPaise = subtotalPaise > 99900 ? 0 : 4900;
      const taxPaise = Math.round(subtotalPaise * 0.18);
      const totalPaise = subtotalPaise + shippingPaise + taxPaise;
      if (input.expectedTotal !== undefined && paise(input.expectedTotal) !== totalPaise) throw new CheckoutError('The order total changed. Review your cart and confirm the updated amount.', 'PRICE_CHANGED');
      if (input.paymentMethod === 'online' && !razorpayOrderId) {
        try { razorpayOrderId = (await createRazorpayOrder(totalPaise, 'INR', humanOrderId)).id; }
        catch { throw new CheckoutError('Payment service is unavailable. Your order was not placed. Please try again later.', 'PAYMENT_UNAVAILABLE', 503); }
      }
      const [order] = await Order.create([{
        orderId: humanOrderId, checkoutId: input.checkoutId, checkoutFingerprint: fingerprint, customer: userId,
        items: validatedItems, shippingAddress: input.shippingAddress, paymentMethod: input.paymentMethod,
        paymentStatus: 'pending', razorpayOrderId, orderStatus: 'placed',
        statusHistory: [{ status: 'placed', timestamp: new Date(), updatedBy: userId }],
        subtotal: subtotalPaise / 100, shippingFee: shippingPaise / 100, tax: taxPaise / 100, total: totalPaise / 100, discount: 0, notes: input.notes,
      }], { session });
      for (const item of validatedItems) {
        const update = await Product.updateOne(
          { _id: item.product, variants: { $elemMatch: { sku: item.variant, stock: { $gte: item.quantity } } } },
          { $inc: { 'variants.$.stock': -item.quantity } }, { session },
        );
        if (update.modifiedCount !== 1) throw new CheckoutError('Stock changed. Review your cart before ordering.', 'STOCK_CHANGED');
      }
      await Cart.updateOne({ user: userId }, { $set: { items: [] } }, { session });
      result = order;
      created = true;
    });
    if (!result) throw new Error('Checkout transaction returned no order');
    if (created) emitNewOrder(result.orderId, { total: result.total, paymentMethod: result.paymentMethod });
    (created ? sendCreated : sendSuccess)(res, checkoutData(result), created ? 'Order placed' : 'Existing order recovered');
  } catch (error) {
    // A concurrent copy may have won the unique-key race. Return only its
    // customer-owned result, never create a fresh checkout identity here.
    if (input.checkoutId && !(error instanceof CheckoutError)) {
      const existing = await saved();
      if (existing && existing.checkoutFingerprint === fingerprint) { sendSuccess(res, checkoutData(existing), 'Existing order recovered'); return; }
    }
    if (error instanceof CheckoutError) sendError(res, error.message, error.status, error.code);
    else { logger.error('Checkout failed', error); sendError(res, 'We could not confirm whether your order was saved. Check your orders or retry this same checkout.', 503, 'ORDER_UNCERTAIN'); }
  } finally { await session?.endSession(); }
}

export async function getCheckoutOrder(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const checkoutId = z.string().uuid().parse(req.params.checkoutId);
  const order = await Order.findOne({ customer: userId, checkoutId });
  if (!order) { sendNotFound(res, 'No saved order was found for this checkout'); return; }
  sendSuccess(res, checkoutData(order));
}

export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const input = z.object({ razorpayOrderId: z.string().min(1).max(100), razorpayPaymentId: z.string().min(1).max(100), razorpaySignature: z.string().min(1).max(256) }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Order not found'); return; }
  const order = await Order.findOne({ _id: req.params.id, customer: userId, razorpayOrderId: input.razorpayOrderId, paymentMethod: 'online' });
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (!verifyRazorpaySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, env.RAZORPAY_KEY_SECRET)) {
    sendError(res, 'We could not verify that payment. Refresh the order to check its current payment status.', 400, 'PAYMENT_VERIFICATION_FAILED'); return;
  }
  const result = await recordCapturedPayment(String(order._id), input.razorpayOrderId, input.razorpayPaymentId);
  sendSuccess(res, result.order && checkoutData(result.order), 'Payment status verified');
}

export async function resumePayment(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { expectedTotal } = z.object({ expectedTotal: z.number().finite().nonnegative() }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Order not found'); return; }
  const order = await Order.findOne({ _id: req.params.id, customer: userId });
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') { sendSuccess(res, checkoutData(order)); return; }
  if (order.paymentMethod !== 'online' || !order.razorpayOrderId || order.orderStatus !== 'placed') { sendError(res, 'This order is not awaiting an online payment. Refresh its details.', 409, 'PAYMENT_NOT_AVAILABLE'); return; }
  if (paise(expectedTotal) !== paise(order.total)) { sendError(res, 'The order total changed. Refresh and review it before paying.', 409, 'PRICE_CHANGED'); return; }
  // A short payment lease also lets the reaper distinguish active attempts.
  const current = await Order.findOneAndUpdate({ _id: order._id, orderStatus: 'placed', paymentStatus: { $in: ['pending', 'failed'] } }, { $set: { paymentAttemptedAt: new Date() }, $inc: { __v: 1 } }, { new: true });
  if (!current) { sendError(res, 'The order changed. Refresh its details before paying.', 409, 'ORDER_CHANGED'); return; }
  try {
    const payments = await fetchOrderPayments(order.razorpayOrderId);
    const captured = payments.find(payment => payment.status === 'captured');
    if (captured) {
      const result = await recordCapturedPayment(String(order._id), order.razorpayOrderId, captured.id);
      sendSuccess(res, result.order && checkoutData(result.order)); return;
    }
    if (payments.some(payment => payment.status === 'authorized')) { sendSuccess(res, { ...checkoutData(current), processing: true }, 'Your payment is still processing'); return; }
    sendSuccess(res, checkoutData(current), 'Continue payment on this saved order');
  } catch { sendError(res, 'We could not check your payment. Please wait, then check this order again.', 503, 'PAYMENT_UNCERTAIN'); }
}
