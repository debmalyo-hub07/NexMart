import Razorpay from 'razorpay';
import { env } from '../config/env';

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export async function createRazorpayOrder(
  amountInPaise: number,
  currency: string,
  receipt: string
): Promise<{ id: string; amount: number; currency: string }> {
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency,
    receipt,
  });
  return { id: order.id as string, amount: order.amount as number, currency: order.currency as string };
}

/**
 * All payments attempted against a Razorpay order — used by the reaper to
 * reconcile orders that were paid but never confirmed (customer closed the
 * tab and the webhook somehow didn't land).
 *
 * NOTE: razorpay 2.9.x's orders.fetchPayments() returns a COLLECTION object
 * `{entity, count, items}` — not an array. Returning the raw object caused
 * the reaper's `payments.find()` to throw on every sweep (audit 2026-09-07
 * §3.2: the reaper never once ran successfully). Extract `items` here so
 * callers get a real array.
 */
export async function fetchOrderPayments(
  razorpayOrderId: string
): Promise<Array<{ id: string; status: string; order_id: string; amount?: number; currency?: string }>> {
  const response = await razorpay.orders.fetchPayments(razorpayOrderId);
  const items = (response as {
    items?: Array<{ id: string; status: string; order_id: string; amount?: number; currency?: string }>;
  }).items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: item.id,
    status: item.status,
    order_id: item.order_id,
    ...(typeof item.amount === 'number' ? { amount: item.amount } : {}),
    ...(typeof item.currency === 'string' ? { currency: item.currency } : {}),
  }));
}

/** Fetch one provider payment when a browser presents a signed callback. The
 * signature proves the payload was formed with our secret; this lookup proves
 * Razorpay actually captured the referenced payment for the expected order. */
export async function fetchPayment(paymentId: string): Promise<{
  id: string;
  order_id?: string;
  status: string;
  amount?: number;
  currency?: string;
}> {
  const payment = await razorpay.payments.fetch(paymentId);
  return {
    id: payment.id as string,
    order_id: payment.order_id as string | undefined,
    status: payment.status as string,
    amount: typeof payment.amount === 'number' ? payment.amount : undefined,
    currency: typeof payment.currency === 'string' ? payment.currency : undefined,
  };
}

export interface ProviderRefund {
  id: string;
  status: string;
  amount: number;
  payment_id: string;
  currency: string;
  receipt?: string | null;
}

/** Razorpay treats receipt as the refund idempotency key. Always submit the
 * stored receipt and exact captured amount, including after ambiguous errors. */
export async function refundPayment(paymentId: string, amountPaise: number, receipt: string): Promise<ProviderRefund> {
  return await razorpay.payments.refund(paymentId, { amount: amountPaise, receipt }) as ProviderRefund;
}

export async function fetchRefund(refundId: string): Promise<ProviderRefund> {
  return await razorpay.refunds.fetch(refundId) as ProviderRefund;
}

export async function findRefundByReceipt(paymentId: string, receipt: string): Promise<ProviderRefund | undefined> {
  // A full-refund request should normally have zero or one provider record.
  // Paginate so earlier partial/dashboard refunds cannot hide our receipt.
  for (let skip = 0; skip < 1000; skip += 100) {
    const page = await razorpay.payments.fetchMultipleRefund(paymentId, { count: 100, skip });
    const match = page.items.find(item => item.receipt === receipt);
    if (match) return match as ProviderRefund;
    if (page.items.length < 100) return undefined;
  }
  throw new Error('Refund history requires manual reconciliation.');
}
