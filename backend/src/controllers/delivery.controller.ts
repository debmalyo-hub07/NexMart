import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { DeliveryAssignment } from '../models/DeliveryAssignment';
import { emitOrderStatusUpdate } from '../config/socket';
import { sendOrderStatusEmail } from '../services/email.service';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { sendSuccess, sendNotFound, sendBadRequest, sendPaginated } from '../utils/response';
import { AuthenticatedRequest, OrderStatus } from '../types';
import { parsePagination } from '../utils/helpers';
import { isTransitionAllowed, ALLOWED_ORDER_TRANSITIONS } from '../utils/orderTransitions';
import { restockOrderItems } from '../utils/orderRestock';

export async function getMyDeliveries(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { page, limit, skip } = parsePagination(req.query);

  const assignments = await DeliveryAssignment.find({ agent: userId })
    .populate({
      path: 'order',
      populate: { path: 'customer', select: 'name phone' },
    })
    .sort('-assignedAt')
    .skip(skip)
    .limit(limit);

  const total = await DeliveryAssignment.countDocuments({ agent: userId });
  sendPaginated(res, assignments, total, page, limit);
}

export async function getDeliveryOrderById(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const assignment = await DeliveryAssignment.findOne({
    agent: userId,
    order: req.params.id,
  }).populate({
    path: 'order',
    populate: [
      { path: 'customer', select: 'name phone email' },
      { path: 'items.product', select: 'name images' },
    ],
  });

  if (!assignment) { sendNotFound(res, 'Delivery not found'); return; }
  sendSuccess(res, assignment);
}

export async function updateDeliveryStatus(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { status, note } = z.object({
    status: z.enum(['picked', 'out_for_delivery', 'delivered', 'attempted', 'returned']),
    note: z.string().optional(),
  }).parse(req.body);

  const assignment = await DeliveryAssignment.findOne({ agent: userId, order: req.params.id });
  if (!assignment) { sendNotFound(res, 'Assignment not found'); return; }

  // Map delivery status to order status
  // picked → 'shipped' (never 'processing': an order the admin already set to
  // 'shipped' must not be regressed backwards by the agent picking it up)
  const orderStatusMap: Partial<Record<typeof status, OrderStatus>> = {
    picked: 'shipped',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    attempted: 'out_for_delivery',
    returned: 'returned',
  };

  const orderStatus = orderStatusMap[status];
  const order = await Order.findById(req.params.id).populate('customer', 'name email');
  if (!order) { sendNotFound(res, 'Order not found'); return; }

  // B2: forward-only guard, shared with the admin status path. An order never
  // moves backwards (e.g. a delivered order cannot return to 'shipped' via a
  // late 'picked'), and cancellation/return are the only exits.
  if (orderStatus && order.orderStatus !== orderStatus && !isTransitionAllowed(order.orderStatus, orderStatus)) {
    sendBadRequest(res, `Order cannot move from "${order.orderStatus}" to "${orderStatus}". Allowed from "${order.orderStatus}": ${(ALLOWED_ORDER_TRANSITIONS[order.orderStatus] || []).join(', ') || 'none (terminal)'}.`);
    return;
  }

  // Update assignment. Milestones are recorded once: a double tap, or a retry
  // after a lost response, must not move the time the parcel was actually
  // picked up or handed over. A failed attempt is different — each attempt is
  // its own event, so that timestamp tracks the most recent one.
  if (status === 'picked' && !assignment.pickedAt) assignment.pickedAt = new Date();
  if (status === 'delivered' && !assignment.deliveredAt) assignment.deliveredAt = new Date();
  if (status === 'attempted') assignment.attemptedAt = new Date();
  assignment.status = status as typeof assignment.status;
  await assignment.save();

  if (orderStatus) {
    // Same-status repeats (e.g. 'picked' once the admin's assignment already
    // set 'shipped') are idempotent no-ops: no order write, no duplicate
    // statusHistory entry, no duplicate email/socket event.
    if (order.orderStatus !== orderStatus) {
      order.orderStatus = orderStatus;
      order.statusHistory.push({ status: orderStatus, timestamp: new Date(), updatedBy: userId, note } as never);

      // Audit §3.5: delivered COD = cash collected — mark the payment paid
      // (same rule the admin status path applies).
      if (orderStatus === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
        order.paymentStatus = 'paid';
      }

      // Audit §3.3: a returned order releases its reserved stock back to
      // sellable inventory (the agent physically has the goods).
      if (orderStatus === 'returned') {
        await restockOrderItems(order);
      }

      await order.save();

      const customer = order.customer as unknown as { name?: string; email?: string; _id: { toString(): string } };
      // Fire-and-forget — SMTP latency never sits in the agent's request path
      if (customer?.email) {
        void sendOrderStatusEmail(customer.email, customer.name || 'Customer', order.orderId, orderStatus)
          .catch((err) => console.error('Order status email failed:', err));
      }
      emitOrderStatusUpdate(customer._id.toString(), order.orderId, orderStatus);

      // B12: delivery confirmations get invoices too — previously only the
      // admin status path and payment-verify queued them, so agent-delivered
      // COD orders never had one.
      if (orderStatus === 'delivered') {
        await queueInvoiceGeneration(order._id.toString());
      }
    }
  }

  sendSuccess(res, assignment, 'Status updated');
}
