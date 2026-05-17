import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';
import { createRazorpayOrder } from '../services/razorpay.service';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { emitOrderStatusUpdate, emitNewOrder } from '../config/socket';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendError, sendPaginated } from '../utils/response';
import { AuthenticatedRequest, OrderStatus } from '../types';
import { generateOrderId, generateDeliveryId, verifyRazorpaySignature, parsePagination } from '../utils/helpers';
import { env } from '../config/env';

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  pincode: z.string().length(6),
  country: z.string().default('India'),
});

const createOrderSchema = z.object({
  items: z.array(z.object({
    product: z.string(),
    variant: z.string(),
    quantity: z.number().int().positive(),
  })),
  shippingAddress: addressSchema,
  paymentMethod: z.enum(['online', 'cod']),
  notes: z.string().optional(),
});

// ── Create Order ──────────────────────────────────────────────
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { items, shippingAddress, paymentMethod, notes } = createOrderSchema.parse(req.body);

  // Re-validate prices from DB (never trust client)
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) { sendBadRequest(res, `Product ${item.product} not found`); return; }

    const variant = product.variants.find((v) => v.sku === item.variant);
    if (!variant) { sendBadRequest(res, `Variant ${item.variant} not found`); return; }
    if (variant.stock < item.quantity) { sendBadRequest(res, `Insufficient stock for ${product.name}`); return; }

    const totalPrice = variant.price * item.quantity;
    subtotal += totalPrice;

    validatedItems.push({
      product: product._id,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: variant.price,
      totalPrice,
    });
  }

  const shippingFee = subtotal > 999 ? 0 : 49;
  const tax = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
  const total = subtotal + shippingFee + tax;
  const orderId = generateOrderId();

  let razorpayOrderId: string | undefined;

  if (paymentMethod === 'online') {
    const rzpOrder = await createRazorpayOrder(Math.round(total * 100), 'INR', orderId);
    razorpayOrderId = rzpOrder.id;
  }

  const order = await Order.create({
    orderId,
    customer: userId,
    items: validatedItems,
    shippingAddress,
    paymentMethod,
    paymentStatus: 'pending',
    razorpayOrderId,
    orderStatus: 'placed',
    statusHistory: [{ status: 'placed', timestamp: new Date(), updatedBy: userId }],
    subtotal,
    shippingFee,
    tax,
    discount: 0,
    total,
    notes,
  });

  // Decrement stock
  for (const item of validatedItems) {
    await Product.updateOne(
      { _id: item.product, 'variants.sku': item.variant },
      { $inc: { 'variants.$.stock': -item.quantity } }
    );
  }

  // Clear user cart
  await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });

  // Notify admin
  emitNewOrder(orderId, { total, paymentMethod });

  sendCreated(res, {
    orderId: order._id,
    humanOrderId: orderId,
    razorpayOrderId,
    total,
    currency: 'INR',
    keyId: paymentMethod === 'online' ? env.RAZORPAY_KEY_ID : undefined,
  }, 'Order created');
}

// ── Verify Payment ────────────────────────────────────────────
export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string(),
  }).parse(req.body);

  // Idempotency check
  const duplicate = await Order.findOne({ razorpayPaymentId });
  if (duplicate) { sendBadRequest(res, 'Payment already processed'); return; }

  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, env.RAZORPAY_KEY_SECRET);

  if (!isValid) {
    await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
    sendError(res, 'Payment verification failed. Invalid signature.', 400);
    return;
  }

  const order = await Order.findOneAndUpdate(
    { razorpayOrderId, customer: userId },
    {
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      razorpayPaymentId,
      razorpaySignature,
      deliveryId: generateDeliveryId(),
      $push: { statusHistory: { status: 'confirmed', timestamp: new Date(), updatedBy: userId } },
    },
    { new: true }
  );

  if (!order) { sendNotFound(res, 'Order not found'); return; }

  // Emit real-time update
  emitOrderStatusUpdate(userId, order.orderId, 'confirmed');

  // Queue invoice generation (async, non-blocking)
  await queueInvoiceGeneration(order._id.toString());

  sendSuccess(res, { orderId: order.orderId, status: 'confirmed' }, 'Payment verified. Order confirmed!');
}

// ── Get Customer Orders ───────────────────────────────────────
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { page, limit, skip } = parsePagination(req.query);

  const [orders, total] = await Promise.all([
    Order.find({ customer: userId }).sort('-createdAt').skip(skip).limit(limit)
      .populate('items.product', 'name images'),
    Order.countDocuments({ customer: userId }),
  ]);

  sendPaginated(res, orders, total, page, limit);
}

// ── Get Order by ID ───────────────────────────────────────────
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const { userId, role } = (req as AuthenticatedRequest).user!;
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (role === 'customer') filter.customer = userId;

  const order = await Order.findOne(filter)
    .populate('customer', 'name email phone')
    .populate('items.product', 'name images')
    .populate('deliveryAgent', 'name phone');

  if (!order) { sendNotFound(res, 'Order not found'); return; }
  sendSuccess(res, order);
}

// ── Update Order Status (Admin/Delivery) ──────────────────────
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { status, note } = z.object({
    status: z.enum(['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned']),
    note: z.string().optional(),
  }).parse(req.body);

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      orderStatus: status,
      $push: { statusHistory: { status, timestamp: new Date(), updatedBy: userId, note } },
    },
    { new: true }
  ).populate('customer', 'email name');

  if (!order) { sendNotFound(res, 'Order not found'); return; }

  // Queue invoice if delivered
  if (status === 'delivered') {
    await queueInvoiceGeneration(order._id.toString());
  }

  const customer = order.customer as unknown as { _id: { toString(): string }; name?: string; email?: string };
  emitOrderStatusUpdate(customer._id.toString(), order.orderId, status);

  sendSuccess(res, order, 'Order status updated');
}

// ── Get Invoice ───────────────────────────────────────────────
export async function getInvoice(req: Request, res: Response): Promise<void> {
  const { userId, role } = (req as AuthenticatedRequest).user!;
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (role === 'customer') filter.customer = userId;

  const order = await Order.findOne(filter);
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (!order.invoiceUrl) {
    // Queue generation if not yet done
    await queueInvoiceGeneration(order._id.toString());
    sendSuccess(res, null, 'Invoice is being generated. Please try again shortly.');
    return;
  }
  sendSuccess(res, { invoiceUrl: order.invoiceUrl });
}
