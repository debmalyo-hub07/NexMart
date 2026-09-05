import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { DeliveryAssignment } from '../models/DeliveryAssignment';
import { emitOrderStatusUpdate } from '../config/socket';
import { sendOrderStatusEmail } from '../services/email.service';
import { sendSuccess, sendNotFound, sendPaginated } from '../utils/response';
import { AuthenticatedRequest, OrderStatus } from '../types';
import { parsePagination } from '../utils/helpers';

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

  // Update assignment
  if (status === 'picked') assignment.pickedAt = new Date();
  if (status === 'delivered') assignment.deliveredAt = new Date();
  if (status === 'attempted') assignment.attemptedAt = new Date();
  assignment.status = status as typeof assignment.status;
  await assignment.save();

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
  if (orderStatus) {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus,
        $push: { statusHistory: { status: orderStatus, timestamp: new Date(), updatedBy: userId, note } },
      },
      { new: true }
    ).populate('customer', 'name email');

    if (order) {
      const customer = order.customer as unknown as { name?: string; email?: string; _id: { toString(): string } };
      try {
        if (customer?.email) {
          await sendOrderStatusEmail(customer.email, customer.name || 'Customer', order.orderId, orderStatus);
        }
      } catch (err) {
        console.error('Order status email failed:', err);
      }
      emitOrderStatusUpdate(customer._id.toString(), order.orderId, orderStatus);
    }
  }

  sendSuccess(res, assignment, 'Status updated');
}
