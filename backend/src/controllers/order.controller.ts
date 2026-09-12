import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { emitOrderStatusUpdate } from '../config/socket';
import { sendOrderStatusEmail } from '../services/email.service';
import { sendSuccess, sendNotFound, sendBadRequest, sendPaginated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { parsePagination } from '../utils/helpers';
import { ALLOWED_ORDER_TRANSITIONS } from '../utils/orderTransitions';
import { restockOrderItems } from '../utils/orderRestock';

export { createOrder, verifyPayment } from './checkout.controller';

// ── Get Customer Orders ───────────────────────────────────────
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { page, limit, skip } = parsePagination(req.query);

  const [orders, total] = await Promise.all([
    Order.find({ customer: userId }).sort('-createdAt').skip(skip).limit(limit)
      .populate('items.product', 'name images slug'),
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
    .populate('items.product', 'name images slug')
    .populate('deliveryAgent', 'name phone');

  if (!order) { sendNotFound(res, 'Order not found'); return; }
  sendSuccess(res, order);
}

// ── Update Order Status (Admin/Delivery) ──────────────────────

// Forward-only transition graph lives in utils/orderTransitions and is shared
// with the delivery-agent status path (CLAUDE.md §4.3: an order never moves
// backwards; cancellation/return are the only exits from the happy path).

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { status, note } = z.object({
    status: z.enum(['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned']),
    note: z.string().optional(),
  }).parse(req.body);

  // Fetch first so the guard and the write act on the same read (no
  // findByIdAndUpdate racing a stale transition check).
  const order = await Order.findById(req.params.id).populate('customer', 'email name');
  if (!order) { sendNotFound(res, 'Order not found'); return; }

  // Idempotent no-op: re-applying the current status succeeds without
  // polluting the history.
  if (order.orderStatus !== status) {
    const allowed = ALLOWED_ORDER_TRANSITIONS[order.orderStatus] || [];
    if (!allowed.includes(status)) {
      sendBadRequest(res, `Order cannot move from "${order.orderStatus}" to "${status}". Allowed from "${order.orderStatus}": ${allowed.join(', ') || 'none (terminal)'}.`);
      return;
    }
    order.orderStatus = status;
    order.statusHistory.push({ status, timestamp: new Date(), updatedBy: userId, note } as any);

    // Audit §3.5: a delivered COD order means the cash was collected — mark
    // the payment paid so revenue analytics (paymentStatus:'paid') counts it.
    // Online orders are already 'paid' at this point (payment-verify/webhook/reaper).
    if (status === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    // Audit §3.3: cancelled and returned orders release their reserved stock
    // back to sellable inventory. Fulfilment transitions consume stock — no restock.
    if (status === 'cancelled' || status === 'returned') {
      await restockOrderItems(order);
    }
  }

  const customer = order.customer as unknown as { _id: { toString(): string }; name?: string; email?: string };

  // Queue invoice if delivered
  if (status === 'delivered') {
    await queueInvoiceGeneration(order._id.toString());
  }

  // Email the customer on meaningful transitions — fire-and-forget so SMTP
  // latency never sits in the request path.
  if (customer?.email) {
    void sendOrderStatusEmail(customer.email, customer.name || 'Customer', order.orderId, status)
      .catch((err) => console.error('Order status email failed:', err));
  }

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
