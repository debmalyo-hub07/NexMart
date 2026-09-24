import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { RefundAttempt } from '../models/RefundAttempt';
import { fetchRefund, findRefundByReceipt, refundPayment, ProviderRefund } from './razorpay.service';
import { recordFullRefundLedger } from './marketplaceLedger.service';
import { sendOrderStatusEmail } from './email.service';
import { emitOrderStatusUpdate } from '../config/socket';
import { logger } from '../utils/logger';

export class RefundError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

type RefundState = 'requested' | 'pending' | 'processed' | 'failed' | 'needs_review';

function refundView(attempt: { status: string; refundId?: string | null; amountPaise: number }) {
  return { refundStatus: attempt.status, refundId: attempt.refundId, amountPaise: attempt.amountPaise };
}

/** Order status and its immutable money reversal commit together. Repeated or
 * out-of-order provider notifications cannot reverse the ledger twice. */
async function persistState(attemptId: string, state: RefundState, provider?: ProviderRefund): Promise<void> {
  const session = await mongoose.startSession();
  let notify: { customer: string; orderId: string; orderStatus: string } | undefined;
  try {
    await session.withTransaction(async () => {
      notify = undefined;
      const attempt = await RefundAttempt.findById(attemptId).session(session);
      if (!attempt || attempt.status === 'processed') return;
      const order = await Order.findById(attempt.order).session(session);
      if (!order) throw new Error('Refund order no longer exists.');
      if (provider && (provider.payment_id !== attempt.paymentId || provider.amount !== attempt.amountPaise || provider.currency !== 'INR')) {
        throw new Error('Provider refund does not match the captured order.');
      }
      // A later pending notification must not undo a known failure.
      if (attempt.status === 'failed' && state !== 'processed') return;
      attempt.status = state;
      attempt.lastCheckedAt = new Date();
      if (provider) attempt.refundId = provider.id;
      order.refund = {
        status: state, amountPaise: attempt.amountPaise,
        refundId: attempt.refundId || undefined, requestedAt: attempt.createdAt,
      };
      if (state === 'processed') {
        if (!provider) throw new Error('A confirmed provider refund is required.');
        if (!['paid', 'refunded'].includes(order.paymentStatus)) throw new Error('Cannot refund an uncaptured order.');
        await recordFullRefundLedger(order, provider.id, 'admin', session);
        attempt.processedAt = new Date();
        order.paymentStatus = 'refunded';
        order.refund.processedAt = attempt.processedAt;
        order.statusHistory.push({
          status: order.orderStatus, timestamp: attempt.processedAt,
          updatedBy: attempt.requestedBy || order.customer,
          note: `Payment refund processed (${provider.id}).`,
        });
        notify = { customer: String(order.customer), orderId: order.orderId, orderStatus: order.orderStatus };
      }
      await attempt.save({ session });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  if (notify) {
    const event = notify as { customer: string; orderId: string; orderStatus: string };
    emitOrderStatusUpdate(event.customer, event.orderId, event.orderStatus);
    // Notification delivery must never turn a committed refund into a failed
    // API response. The order remains the durable source of truth.
    void Customer.findById(event.customer).select('name email').lean().then(customer => {
      if (customer?.email) return sendOrderStatusEmail(customer.email, customer.name, event.orderId, 'refunded');
    }).catch(error => logger.warn('Refund notification failed', { message: error?.message }));
  }
}

function providerState(provider: ProviderRefund): RefundState {
  if (provider.status === 'processed') return 'processed';
  if (provider.status === 'failed') return 'failed';
  if (provider.status === 'pending' || provider.status === 'created') return 'pending';
  return 'needs_review';
}

export async function requestFullRefund(orderId: string, adminId?: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new RefundError('Order not found', 404);
  if (order.paymentMethod !== 'online') throw new RefundError('Cash-on-delivery payments require a separately verified repayment.');
  if (order.paymentStatus === 'refunded') return { refundStatus: 'processed', refundId: order.refund?.refundId, amountPaise: order.totalPaise ?? Math.round(order.total * 100) };
  if (order.paymentStatus !== 'paid' || !order.razorpayPaymentId) throw new RefundError('Only a captured online payment can be refunded.');
  const amountPaise = order.totalPaise ?? Math.round(order.total * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new RefundError('Order amount requires review before refunding.');
  let attempt;
  try {
    attempt = await RefundAttempt.findOneAndUpdate({ order: order._id }, { $setOnInsert: {
      order: order._id, paymentId: order.razorpayPaymentId, amountPaise,
      receipt: `nm_rf_${String(order._id)}`, status: 'requested', requestedBy: adminId,
    } }, { upsert: true, new: true });
  } catch (error: unknown) {
    if ((error as { code?: number }).code !== 11000) throw error;
    attempt = await RefundAttempt.findOne({ order: order._id });
  }
  if (!attempt) throw new Error('Refund intent could not be saved.');
  if (attempt.paymentId !== order.razorpayPaymentId || attempt.amountPaise !== amountPaise) throw new RefundError('Existing refund requires reconciliation.', 409);
  if (['processed', 'failed'].includes(attempt.status)) return refundView(attempt);

  const leaseOwner = randomUUID();
  const lease = await RefundAttempt.findOneAndUpdate({
    _id: attempt._id, status: { $in: ['requested', 'pending', 'needs_review'] },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: new Date() } }],
  }, { $set: { leaseUntil: new Date(Date.now() + 120_000), leaseOwner } }, { new: true });
  if (!lease) return refundView(attempt);
  try {
    await persistState(String(attempt._id), 'requested');
    // Looking up the durable receipt recovers a request whose provider call
    // succeeded but whose HTTP response or subsequent database write was lost.
    const existing = lease.refundId ? await fetchRefund(lease.refundId) : await findRefundByReceipt(lease.paymentId, lease.receipt);
    const provider = existing || await refundPayment(lease.paymentId, lease.amountPaise, lease.receipt);
    await persistState(String(lease._id), providerState(provider), provider);
  } catch (error) {
    logger.error('Refund awaits reconciliation', { orderId: order.orderId, message: (error as Error).message });
    await persistState(String(lease._id), 'needs_review');
  } finally {
    await RefundAttempt.updateOne({ _id: lease._id, leaseOwner }, { $unset: { leaseUntil: 1, leaseOwner: 1 }, $set: { lastCheckedAt: new Date() } });
  }
  const current = await RefundAttempt.findById(lease._id);
  if (!current) throw new Error('Refund record could not be read.');
  return refundView(current);
}

/** Signed webhook identifiers are reconciled with the provider's current
 * record, rather than trusting event arrival order. Dashboard full refunds
 * are also recorded; partial refunds require an explicit allocation review. */
export async function reconcileRefundEvent(refundId: string): Promise<void> {
  const provider = await fetchRefund(refundId);
  const order = await Order.findOne({ razorpayPaymentId: provider.payment_id, paymentMethod: 'online' });
  if (!order || order.paymentStatus === 'refunded') return;
  const amount = order.totalPaise ?? Math.round(order.total * 100);
  if (provider.amount !== amount || provider.currency !== 'INR') {
    logger.error('Partial or mismatched provider refund requires allocation review', { orderId: order.orderId, refundId });
    return;
  }
  const attempt = await RefundAttempt.findOneAndUpdate({ order: order._id }, { $setOnInsert: {
    order: order._id, paymentId: provider.payment_id, amountPaise: amount,
    receipt: provider.receipt || `nm_rf_${String(order._id)}`, status: 'requested',
  } }, { upsert: true, new: true });
  if (!attempt) throw new Error('Refund event could not be saved.');
  await persistState(String(attempt._id), providerState(provider), provider);
}

export function startRefundReconciler(): void {
  let running = false;
  const reconcile = async () => {
    if (running) return;
    running = true;
    try {
      const attempts = await RefundAttempt.find({
        status: { $in: ['requested', 'pending', 'needs_review'] },
        $or: [{ lastCheckedAt: { $exists: false } }, { lastCheckedAt: { $lt: new Date(Date.now() - 60_000) } }],
      }).sort({ lastCheckedAt: 1 }).limit(20).lean();
      for (const attempt of attempts) {
        try { await requestFullRefund(String(attempt.order)); }
        catch (error) { logger.error('Refund reconciliation failed', { message: (error as Error).message }); }
      }
    } finally { running = false; }
  };
  const run = () => { void reconcile().catch(error => logger.error('Refund reconciliation sweep failed', { message: error?.message })); };
  setInterval(run, 60_000).unref();
  run();
}
