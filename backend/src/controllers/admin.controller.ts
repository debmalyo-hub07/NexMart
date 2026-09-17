import { Request, Response } from 'express';
import mongoose from 'mongoose';
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
import { isTransitionAllowed } from '../utils/orderTransitions';
import { z } from 'zod';
import { recordFullRefundLedger } from '../services/marketplaceLedger.service';
import { MarketplaceLedgerEntry } from '../models/MarketplaceLedgerEntry';
import { MarketplaceFeeRule, FEE_RULE_STATUSES, type FeeRuleStatus } from '../models/MarketplaceFeeRule';

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
  const cacheKey = 'nexmart:admin:dashboard:stats:v2';
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
    totalOrders, totalGmv, totalPlatformRevenue, totalUsers, totalProducts,
    monthlyOrders, monthlyGmv, monthlyPlatformRevenue, pendingOrders, recentOrders,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: null, totalPaise: { $sum: { $ifNull: ['$totalPaise', { $multiply: ['$total', 100] }] } } } }]),
    MarketplaceLedgerEntry.aggregate([
      { $match: { account: 'platform_revenue' } },
      { $group: { _id: null, totalPaise: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', { $multiply: ['$amountPaise', -1] }] } } } },
    ]),
    Customer.countDocuments(),
    Product.countDocuments({ isPublished: true }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, totalPaise: { $sum: { $ifNull: ['$totalPaise', { $multiply: ['$total', 100] }] } } } }]),
    MarketplaceLedgerEntry.aggregate([
      { $match: { account: 'platform_revenue', effectiveAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalPaise: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', { $multiply: ['$amountPaise', -1] }] } } } },
    ]),
    Order.countDocuments({ orderStatus: { $in: ['placed', 'confirmed', 'processing'] } }),
    Order.find().sort('-createdAt').limit(5).populate('customer', 'name email'),
  ]);

  const stats = {
    totalOrders,
    // `totalRevenue` is retained as a compatibility alias, but it now means
    // actual platform fee revenue. Gross merchandise value is exposed
    // separately so it cannot be mistaken for NexMart income.
    totalRevenue: (totalPlatformRevenue[0]?.totalPaise || 0) / 100,
    platformRevenue: (totalPlatformRevenue[0]?.totalPaise || 0) / 100,
    totalGmv: (totalGmv[0]?.totalPaise || 0) / 100,
    totalUsers,
    totalProducts,
    monthlyOrders,
    monthlyRevenue: (monthlyPlatformRevenue[0]?.totalPaise || 0) / 100,
    monthlyPlatformRevenue: (monthlyPlatformRevenue[0]?.totalPaise || 0) / 100,
    monthlyGmv: (monthlyGmv[0]?.totalPaise || 0) / 100,
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

  // Assignment respects the shared state machine. An order already handed to
  // the road keeps its status — re-assigning must not show the customer a jump
  // back from "out for delivery" to "shipped" — and a delivered, cancelled or
  // returned order cannot be assigned at all.
  const alreadyDispatched = order.orderStatus === 'shipped' || order.orderStatus === 'out_for_delivery';
  if (!alreadyDispatched && !isTransitionAllowed(order.orderStatus, 'shipped')) {
    sendBadRequest(res, `An order that is "${order.orderStatus}" cannot be assigned to a delivery agent.`);
    return;
  }

  // The assignment is written first. If this write fails the order still reads
  // exactly as it did and the operator can retry; the reverse order could
  // leave an order marked shipped that no agent has been given.
  await DeliveryAssignment.findOneAndUpdate(
    { order: orderId },
    { order: orderId, agent: agentId, assignedAt: new Date(), status: 'assigned' },
    { upsert: true, new: true }
  );

  order.deliveryAgent = agent._id;
  if (!alreadyDispatched) {
    order.orderStatus = 'shipped';
    order.statusHistory.push({ status: 'shipped', timestamp: new Date(), updatedBy: agent._id } as typeof order.statusHistory[0]);
  }
  await order.save();

  try {
    await sendAgentAssignmentEmail(agent.email, agent.name, order.orderId);
  } catch (err) {
    console.error('Failed to send agent assignment email:', err);
  }

  // Only a real status change is announced to the customer.
  if (!alreadyDispatched) emitOrderStatusUpdate(order.customer.toString(), order.orderId, 'shipped');
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

    // New money-versioned orders also receive an immutable reversal event.
    // Legacy test/records without a total remain compatible with the existing
    // provider-only path until their money migration is complete.
    if (Number.isSafeInteger(order.totalPaise) || (typeof order.total === 'number' && Number.isFinite(order.total))) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await recordFullRefundLedger(
            order,
            String(refund.id),
            'admin',
            session,
            (req as Request & { requestId?: string }).requestId,
          );
        });
      } finally {
        await session.endSession();
      }
    }

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
  const parsedDays = Number.parseInt(req.query.days as string, 10);
  const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dailyRevenue, dailyGmv, topProducts, ordersByStatus] = await Promise.all([
    // Ledger credits are platform revenue; reversal debits subtract from it.
    // Group by order first so a single capture with several fee components is
    // counted once in the order column.
    MarketplaceLedgerEntry.aggregate([
      { $match: { account: 'platform_revenue', effectiveAt: { $gte: since } } },
      { $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveAt' } },
          order: '$order',
        },
        revenuePaise: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', { $multiply: ['$amountPaise', -1] }] } },
      } },
      { $group: { _id: '$_id.date', revenuePaise: { $sum: '$revenuePaise' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, gmvPaise: { $sum: { $ifNull: ['$totalPaise', { $multiply: ['$total', 100] }] } }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' }, gmvPaise: { $sum: { $ifNull: ['$items.totalPricePaise', { $multiply: ['$items.totalPrice', 100] }] } } } },
      { $sort: { gmvPaise: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { name: '$product.name', slug: '$product.slug', totalSold: 1, gmv: { $divide: ['$gmvPaise', 100] } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const gmvByDate = new Map(dailyGmv.map((row) => [row._id, row]));
  const normalizedRevenue = dailyRevenue.map((row) => ({
    _id: row._id,
    revenue: (row.revenuePaise || 0) / 100,
    platformRevenue: (row.revenuePaise || 0) / 100,
    gmv: (gmvByDate.get(row._id)?.gmvPaise || 0) / 100,
    orders: row.orders,
  }));
  const normalizedProducts = topProducts.map((product) => ({
    ...product,
    // Keep the old property for clients that have not upgraded yet; all new
    // UI labels use `gmv`, never `revenue`, for item value.
    revenue: product.gmv,
  }));
  sendSuccess(res, { dailyRevenue: normalizedRevenue, dailyPlatformRevenue: normalizedRevenue, topProducts: normalizedProducts, ordersByStatus });
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

export async function getFeeRules(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && FEE_RULE_STATUSES.includes(req.query.status as FeeRuleStatus)) {
    filter.status = req.query.status;
  }
  if (req.query.category && mongoose.isValidObjectId(req.query.category)) {
    filter.category = req.query.category;
  }
  const [rules, total] = await Promise.all([
    MarketplaceFeeRule.find(filter)
      .sort('-effectiveFrom -version')
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .lean(),
    MarketplaceFeeRule.countDocuments(filter),
  ]);
  sendPaginated(res, rules, total, page, limit);
}

export async function createFeeRule(req: Request, res: Response): Promise<void> {
  const adminId = (req as any).user?.id || (req as any).user?.userId;
  const schema = z.object({
    ruleKey: z.string().trim().min(2).max(80),
    category: z.string().optional().refine((val) => !val || mongoose.isValidObjectId(val), 'Invalid category ID'),
    fulfillmentMode: z.enum(['seller', 'nexmart']).optional(),
    commissionBps: z.number().int().min(0).max(10000),
    fixedFeePaise: z.number().int().min(0).default(0),
    shippingCostPaise: z.number().int().min(0).default(0),
    otherFeePaise: z.number().int().min(0).default(0),
    reserveBps: z.number().int().min(0).max(10000).default(0),
    paymentCollection: z.object({
      onlineBps: z.number().int().min(0).max(10000).default(200),
      onlineFixedPaise: z.number().int().min(0).default(0),
      codBps: z.number().int().min(0).max(10000).default(200),
      codFixedPaise: z.number().int().min(0).default(0),
    }).default({ onlineBps: 200, onlineFixedPaise: 0, codBps: 200, codFixedPaise: 0 }),
    returnFeePaise: z.number().int().min(0).default(0),
    requiresProfessionalReview: z.boolean().default(false),
    status: z.enum(['draft', 'active']).default('active'),
    effectiveFrom: z.string().datetime().optional(),
  });

  const parsed = schema.parse(req.body);
  const latestVersion = await MarketplaceFeeRule.findOne({ ruleKey: parsed.ruleKey }).sort('-version').select('version').lean();
  const version = (latestVersion?.version ?? 0) + 1;
  const ruleId = `${parsed.ruleKey}:v${version}`;

  const rule = await MarketplaceFeeRule.create({
    ...parsed,
    ruleId,
    version,
    category: parsed.category ? new mongoose.Types.ObjectId(parsed.category) : undefined,
    effectiveFrom: parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : new Date(),
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : undefined,
  });

  sendSuccess(res, rule, 'Fee rule created', 201);
}

export async function updateFeeRuleStatus(req: Request, res: Response): Promise<void> {
  const { status } = z.object({ status: z.enum(FEE_RULE_STATUSES) }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Fee rule not found'); return; }
  const rule = await MarketplaceFeeRule.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!rule) { sendNotFound(res, 'Fee rule not found'); return; }
  sendSuccess(res, rule, 'Fee rule status updated');
}

export async function getLedgerEntries(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.account === 'string') filter.account = req.query.account;
  if (typeof req.query.eventType === 'string') filter.eventType = req.query.eventType;
  if (req.query.seller && mongoose.isValidObjectId(req.query.seller as string)) filter.seller = req.query.seller;
  if (req.query.order && mongoose.isValidObjectId(req.query.order as string)) filter.order = req.query.order;

  const [entries, total] = await Promise.all([
    MarketplaceLedgerEntry.find(filter)
      .sort('-effectiveAt -createdAt')
      .skip(skip)
      .limit(limit)
      .populate('seller', 'storefrontName')
      .populate('order', 'orderId total')
      .lean(),
    MarketplaceLedgerEntry.countDocuments(filter),
  ]);
  sendPaginated(res, entries, total, page, limit);
}

export async function getLedgerSummary(req: Request, res: Response): Promise<void> {
  const summary = await MarketplaceLedgerEntry.aggregate([
    {
      $group: {
        _id: '$account',
        totalCreditPaise: {
          $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', 0] },
        },
        totalDebitPaise: {
          $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amountPaise', 0] },
        },
      },
    },
  ]);

  const formatted: Record<string, { balancePaise: number; balanceRupees: number; creditRupees: number; debitRupees: number }> = {};
  for (const row of summary) {
    const netPaise = row.totalCreditPaise - row.totalDebitPaise;
    formatted[row._id] = {
      balancePaise: netPaise,
      balanceRupees: netPaise / 100,
      creditRupees: row.totalCreditPaise / 100,
      debitRupees: row.totalDebitPaise / 100,
    };
  }

  sendSuccess(res, formatted);
}
