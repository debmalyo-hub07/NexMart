import { Order } from '../models/Order';
import { fetchOrderPayments } from './razorpay.service';
import { sendOrderStatusEmail } from './email.service';
import { emitOrderStatusUpdate } from '../config/socket';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { generateDeliveryId } from '../utils/helpers';
import { restockOrderItems } from '../utils/orderRestock';
import { logger } from '../utils/logger';

/**
 * Stale-order reaper + payment reconciliation (in-process, like the invoice
 * worker — no extra infrastructure).
 *
 * Every INTERVAL_MS it looks at ONLINE orders still pending 30+ minutes after
 * creation and, for each:
 *   1. RECONCILES first — asks Razorpay for the payments on that order. If
 *      one was captured (customer paid, but the verify call and the webhook
 *      both somehow missed), the order is confirmed: paid + confirmed +
 *      invoice queued + customer notified. Money is never auto-cancelled.
 *   2. Otherwise CANCELS — the checkout was abandoned, so the order is
 *      cancelled, every item is restocked, and the customer is notified.
 *
 * COD orders are deliberately NOT reaped: pending COD simply means an admin
 * hasn't confirmed it yet.
 */

const INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes
const INITIAL_DELAY_MS = 60 * 1000; // let the server settle first
const STALE_AFTER_MS = 30 * 60 * 1000; // pending older than 30 minutes

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function reconcileOrCancel(order: any): Promise<'confirmed' | 'cancelled' | 'skipped'> {
  // Re-check under the reaper's own read — another request may have confirmed
  // it between the query and now. 'failed' orders are still cancellable
  // (their payment is known-dead; the Razorpay check below only matters for
  // 'pending' ones, which may turn out to be secretly paid).
  const fresh = await Order.findById(order._id);
  if (!fresh || !['pending', 'failed'].includes(fresh.paymentStatus) || fresh.orderStatus !== 'placed') {
    return 'skipped';
  }
  if (fresh.paymentStatus === 'failed') {
    // Payment definitively failed (webhook or bad-signature verify path).
    // A second capture on the same Razorpay order is not a thing — cancel now.
    return cancelAndRestock(fresh, 'Auto-cancelled: payment failed');
  }

  // 1. Reconciliation: was it actually paid?
  let payments: Array<{ id: string; status: string }> = [];
  try {
    payments = await fetchOrderPayments(fresh.razorpayOrderId!);
  } catch (err) {
    // Razorpay unreachable/unknown order — do NOT cancel on a maybe; retry next cycle.
    logger.error(`Reaper: could not fetch payments for ${fresh.orderId} — leaving for next cycle:`, err instanceof Error ? err.message : err);
    return 'skipped';
  }

  const captured = payments.find((p) => p.status === 'captured');
  if (captured) {
    fresh.paymentStatus = 'paid';
    fresh.orderStatus = 'confirmed';
    fresh.razorpayPaymentId = fresh.razorpayPaymentId || captured.id;
    if (!fresh.deliveryId) fresh.deliveryId = generateDeliveryId();
    fresh.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      updatedBy: fresh.customer,
      note: 'Reconciled by reaper: payment captured at Razorpay',
    } as any);
    await fresh.save();

    emitOrderStatusUpdate(fresh.customer.toString(), fresh.orderId, 'confirmed');
    await queueInvoiceGeneration(fresh._id.toString());
    const customer = await Order.findById(fresh._id).populate('customer', 'name email') as any;
    const c = customer?.customer as { name?: string; email?: string } | undefined;
    if (c?.email) {
      void sendOrderStatusEmail(c.email, c.name || 'Customer', fresh.orderId, 'confirmed')
        .catch((err) => console.error('Reaper confirmation email failed:', err));
    }
    logger.info(`Reaper: RECONCILED ${fresh.orderId} — payment was captured, order confirmed.`);
    return 'confirmed';
  }

  // 2. Cancel + restock (shared path for abandoned and failed orders)
  return cancelAndRestock(fresh, 'Auto-cancelled: payment not completed within 30 minutes');
}

async function cancelAndRestock(fresh: any, note: string): Promise<'cancelled'> {
  fresh.orderStatus = 'cancelled';
  fresh.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    updatedBy: null,
    note,
  } as any);
  await fresh.save();

  // Shared helper — a deleted product/variant must never abort the sweep
  await restockOrderItems(fresh);

  emitOrderStatusUpdate(fresh.customer.toString(), fresh.orderId, 'cancelled');
  const populated = await Order.findById(fresh._id).populate('customer', 'name email') as any;
  const pc = populated?.customer as { name?: string; email?: string } | undefined;
  if (pc?.email) {
    void sendOrderStatusEmail(pc.email, pc.name || 'Customer', fresh.orderId, 'cancelled')
      .catch((err) => console.error('Reaper cancellation email failed:', err));
  }
  logger.info(`Reaper: CANCELLED ${fresh.orderId} (abandoned checkout) — ${fresh.items.length} item(s) restocked.`);
  return 'cancelled';
}

async function sweep(): Promise<void> {
  if (running) return; // previous cycle still going — skip, don't pile up
  running = true;
  try {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
    const staleOrders = await Order.find({
      paymentMethod: 'online',
      // 'failed' joins 'pending' (audit §3.4): a failed payment previously
      // left the order a zombie — placed forever, stock never released.
      paymentStatus: { $in: ['pending', 'failed'] },
      orderStatus: 'placed',
      razorpayOrderId: { $exists: true, $ne: null },
      createdAt: { $lt: staleBefore },
    }).limit(50); // bounded per cycle

    if (staleOrders.length === 0) return;

    let confirmed = 0;
    let cancelled = 0;
    let errored = 0;
    for (const order of staleOrders) {
      // Per-order isolation (audit §3.2b): one bad order must not poison the
      // rest of the cycle — previously a single throw skipped every remaining
      // order until the next sweep.
      let result: 'confirmed' | 'cancelled' | 'skipped';
      try {
        result = await reconcileOrCancel(order);
      } catch (err) {
        errored += 1;
        logger.error(
          `Reaper: error processing order ${(order as any).orderId}:`,
          err instanceof Error ? err.message : err
        );
        continue;
      }
      if (result === 'confirmed') confirmed += 1;
      if (result === 'cancelled') cancelled += 1;
    }
    logger.info(
      `Reaper sweep: checked ${staleOrders.length}, confirmed ${confirmed}, cancelled ${cancelled}, errored ${errored}.`
    );
  } catch (err) {
    // The reaper must never crash the process
    logger.error('Reaper sweep failed:', err);
  } finally {
    running = false;
  }
}

export function startOrderReaper(): void {
  if (timer) return; // idempotent start
  setTimeout(() => {
    void sweep();
    timer = setInterval(() => void sweep(), INTERVAL_MS);
    timer.unref?.(); // don't keep the process alive just for the reaper
  }, INITIAL_DELAY_MS).unref?.();
  logger.info(`✅ Order reaper scheduled (every ${INTERVAL_MS / 60000} min, stale after ${STALE_AFTER_MS / 60000} min)`);
}

// Exported for tests: run one sweep immediately (the scheduler itself is
// timer-driven and not worth faking).
export function sweepNow(): Promise<void> {
  return sweep();
}
