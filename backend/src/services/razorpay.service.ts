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
 */
export async function fetchOrderPayments(
  razorpayOrderId: string
): Promise<Array<{ id: string; status: string; order_id: string }>> {
  const payments = await razorpay.orders.fetchPayments(razorpayOrderId);
  return payments as unknown as Array<{ id: string; status: string; order_id: string }>;
}

/**
 * Full refund of a captured payment. Returns the Razorpay refund record.
 * (An empty params object = refund the entire amount.)
 */
export async function refundPayment(paymentId: string): Promise<{ id: string; status: string; amount: number }> {
  const refund = await razorpay.payments.refund(paymentId, {});
  return {
    id: refund.id as string,
    status: refund.status as string,
    amount: refund.amount as number,
  };
}
