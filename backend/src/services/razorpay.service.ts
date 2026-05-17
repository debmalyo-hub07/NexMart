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
