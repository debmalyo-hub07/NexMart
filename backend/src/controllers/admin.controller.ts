import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { Product } from '../models/Product';
import { DeliveryAssignment } from '../models/DeliveryAssignment';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { Admin } from '../models/Admin';
import { sendSuccess, sendNotFound, sendBadRequest, sendError, sendPaginated } from '../utils/response';
import { parsePagination, parseSortField } from '../utils/helpers';
import { sendAgentAssignmentEmail, sendOrderStatusEmail } from '../services/email.service';
import { emitOrderStatusUpdate, emitDeliveryAssigned } from '../config/socket';
import { refundPayment } from '../services/razorpay.service';
import { upstashRedis } from '../config/redis';
import { logger } from '../utils/logger';

// Server-side sort allow-lists. The `sort` query param uses Mongo syntax:
// 'field' for ascending, '-field' for descending. parseSortField falls back
// to '-createdAt' when the param is absent or not allow-listed, so callers
// that send no sort param keep the previous behaviour (mirrors the public
// /products endpoint's ALLOWED_SORT pattern).
const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'variants.0.price', 'variants.0.stock'];
const ORDER_SORT_FIELDS = ['createdAt', 'orderId', 'total'];
const USER_SORT_FIELDS = ['createdAt', 'name', 'email'];

export async function getAllProducts(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSortField(req.query.sort as string, PRODUCT_SORT_FIELDS, '-createdAt');
  const filter: Record<string, unknown> = {};
  if (req.query.q) {
    const searchRegex = new RegExp(req.query.q as string, 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).populate('category', 'name'),
    Product.countDocuments(filter),
  ]);

  sendPaginated(res, products, total, page, limit);
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const cacheKey = 'nexmart:admin:dashboard:stats';
  try {
    const cached = await upstashRedis.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }
  } catch (err) {
    console.error('Redis read error for dashboard stats:', err);
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders, totalRevenue, totalUsers, totalProducts,
    monthlyOrders, monthlyRevenue, pendingOrders, recentOrders,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
    Customer.countDocuments(),
    Product.countDocuments({ isPublished: true }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.countDocuments({ orderStatus: { $in: ['placed', 'confirmed', 'processing'] } }),
    Order.find().sort('-createdAt').limit(5).populate('customer', 'name email'),
  ]);

  const stats = {
    totalOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
    totalUsers,
    totalProducts,
    monthlyOrders,
    monthlyRevenue: monthlyRevenue[0]?.total || 0,
    pendingOrders,
    recentOrders,
  };

  try {
    await upstashRedis.set(cacheKey, stats, { ex: 30 }); // 30 seconds TTL
  } catch (err) {
    console.error('Redis write error for dashboard stats:', err);
  }

  sendSuccess(res, stats);
}

export async function getAllOrders(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSortField(req.query.sort as string, ORDER_SORT_FIELDS, '-createdAt');
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.orderStatus = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('customer', 'name email phone')
      .populate('deliveryAgent', 'name'),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
}

export async function getAllUsers(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSortField(req.query.sort as string, USER_SORT_FIELDS, '-createdAt');
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    const s = new RegExp(req.query.search as string, 'i');
    Object.assign(filter, { $or: [{ name: s }, { email: s }] });
  }

  const [users, total] = await Promise.all([
    // otp/otpExpiry are sensitive: the plaintext OTP must never reach any
    // API response (a leaked admin session must not become an account
    // takeover of every pending-verification customer).
    Customer.find(filter).select('-password -otp -otpExpiry').sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  sendPaginated(res, users, total, page, limit);
}

export async function getDeliveryAgents(req: Request, res: Response): Promise<void> {
  const agents = await DeliveryAgent.find({ status: 'approved' }).select('-password');
  sendSuccess(res, agents);
}

export async function getAllAgents(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const s = new RegExp(req.query.search as string, 'i');
    Object.assign(filter, { $or: [{ name: s }, { email: s }] });
  }

  const [agents, total] = await Promise.all([
    DeliveryAgent.find(filter).select('-password').sort('-createdAt').skip(skip).limit(limit),
    DeliveryAgent.countDocuments(filter),
  ]);

  sendPaginated(res, agents, total, page, limit);
}

export async function assignDeliveryAgent(req: Request, res: Response): Promise<void> {
  const { orderId, agentId } = req.params;

  const [order, agent] = await Promise.all([
    Order.findById(orderId),
    DeliveryAgent.findOne({ _id: agentId, status: 'approved' }),
  ]);

  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (!agent) { sendNotFound(res, 'Delivery agent not found'); return; }

  order.deliveryAgent = agent._id;
  order.orderStatus = 'shipped';
  order.statusHistory.push({ status: 'shipped', timestamp: new Date(), updatedBy: agent._id } as typeof order.statusHistory[0]);
  await order.save();

  await DeliveryAssignment.findOneAndUpdate(
    { order: orderId },
    { order: orderId, agent: agentId, assignedAt: new Date(), status: 'assigned' },
    { upsert: true, new: true }
  );

  try {
    await sendAgentAssignmentEmail(agent.email, agent.name, order.orderId);
  } catch (err) {
    console.error('Failed to send agent assignment email:', err);
  }

  emitOrderStatusUpdate(order.customer.toString(), order.orderId, 'shipped');
  // Real-time assignment notification for the agent (email stays the
  // durable channel; the socket event makes the dashboard update instantly)
  emitDeliveryAssigned(agent._id.toString(), order.orderId, {
    customerName: (order.shippingAddress as { fullName?: string } | undefined)?.fullName,
  });

  sendSuccess(res, order, 'Delivery agent assigned');
}

// ── Refund a paid order (full refund via Razorpay) ─────────────
export async function refundOrder(req: Request, res: Response): Promise<void> {
  const adminId = (req as any).user?.userId as string | undefined;

  const order = await Order.findById(req.params.id).populate('customer', 'name email');
  if (!order) { sendNotFound(res, 'Order not found'); return; }

  if (order.paymentMethod !== 'online') {
    sendBadRequest(res, 'Only online payments can be refunded. COD orders have no payment to refund.');
    return;
  }
  if (order.paymentStatus !== 'paid') {
    sendBadRequest(res, `Only paid orders can be refunded (current payment status: ${order.paymentStatus}).`);
    return;
  }
  if (!order.razorpayPaymentId) {
    sendBadRequest(res, 'This order has no Razorpay payment ID on file — refund it from the Razorpay dashboard.');
    return;
  }

  try {
    const refund = await refundPayment(order.razorpayPaymentId);

    order.paymentStatus = 'refunded';
    order.statusHistory.push({
      status: order.orderStatus, // the fulfilment status is unchanged; the PAYMENT is refunded
      timestamp: new Date(),
      updatedBy: adminId,
      note: `Payment refunded via Razorpay (refund ${refund.id}, ₹${(refund.amount / 100).toFixed(2)})`,
    } as any);
    await order.save();

    const customer = order.customer as unknown as { _id: { toString(): string }; name?: string; email?: string };
    emitOrderStatusUpdate(customer._id.toString(), order.orderId, order.orderStatus);
    // Audit §3.6: the PAYMENT is refunded — the fulfilment status is unchanged.
    // Say "refunded", not "cancelled" (a delivered order that got its money
    // back is not cancelled).
    if (customer?.email) {
      void sendOrderStatusEmail(customer.email, customer.name || 'Customer', order.orderId, 'refunded')
        .catch((err) => console.error('Refund email failed:', err));
    }

    logger.info(`Refund: order ${order.orderId} refunded (refund ${refund.id}, status ${refund.status}).`);
    sendSuccess(res, { refundId: refund.id, refundStatus: refund.status, orderStatus: order.orderStatus }, 'Refund initiated successfully');
  } catch (err: any) {
    // SDK detail to the server log only — the admin gets a clean message
    console.error('Razorpay refund failed:', err?.error?.description || err?.message || err);
    sendError(res, 'The refund could not be processed. Please try again or use the Razorpay dashboard.', 503);
  }
}

export async function getRevenueAnalytics(req: Request, res: Response): Promise<void> {
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dailyRevenue, topProducts, ordersByStatus] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.totalPrice' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { name: '$product.name', slug: '$product.slug', totalSold: 1, revenue: 1 } },
    ]),
    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  sendSuccess(res, { dailyRevenue, topProducts, ordersByStatus });
}

export async function updateAdminProfile(req: Request, res: Response): Promise<void> {
  const { name, email } = req.body;
  const adminId = (req as any).user.id;

  // Check if email is already used by another admin
  if (email) {
    const existing = await Admin.findOne({ email, _id: { $ne: adminId } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Email already in use by another admin', data: null });
      return;
    }
  }

  const updatedAdmin = await Admin.findByIdAndUpdate(
    adminId,
    { $set: { ...(name && { name }), ...(email && { email }) } },
    { new: true, runValidators: true }
  ).select('-password');

  sendSuccess(res, updatedAdmin, 'Profile updated successfully');
}
