import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { Order } from '../models/Order';
import { logger } from '../utils/logger';
import { recordCapturedPayment } from '../services/orderPayment.service';

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Server-to-server payment confirmation. Mounted with express.raw() BEFORE the
 * JSON/CSRF layers so the raw request body is available for HMAC verification.
 *
 * This is the source of truth for payment status: even if the customer closes the
 * browser tab right after paying (never calling /orders/:id/payment/verify), Razorpay
 * still delivers `payment.captured` here and the order is confirmed. Fully idempotent.
 */
export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('Razorpay webhook hit but RAZORPAY_WEBHOOK_SECRET is not configured — ignoring.');
    res.status(503).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody = req.body as Buffer;
  if (!signature || !Buffer.isBuffer(rawBody)) {
    res.status(400).json({ success: false, message: 'Missing signature or raw body' });
    return;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  let valid: boolean;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    valid = false;
  }
  if (!valid) {
    logger.warn('Razorpay webhook signature mismatch — rejecting.');
    res.status(400).json({ success: false, message: 'Invalid signature' });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    return;
  }

  try {
    const type: string | undefined = event?.event;
    const payment = event?.payload?.payment?.entity;
    const rzpOrderId: string | undefined = payment?.order_id;

    if (rzpOrderId && (type === 'payment.captured' || type === 'order.paid')) {
      const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
      if (order && typeof payment?.id === 'string') {
        await recordCapturedPayment(String(order._id), rzpOrderId, payment.id);
        logger.info(`Razorpay webhook: order ${order.orderId} marked paid (${type}).`);
      }
    } else if (rzpOrderId && type === 'payment.failed') {
      await Order.findOneAndUpdate(
        { razorpayOrderId: rzpOrderId, paymentStatus: 'pending' },
        { $set: { paymentStatus: 'failed' }, $inc: { __v: 1 } }
      );
      logger.info(`Razorpay webhook: order for ${rzpOrderId} marked failed.`);
    }
  } catch (err) {
    logger.error('Razorpay webhook processing error:', err);
    // Acknowledging a failed write would discard the provider's retry.
    res.status(503).json({ success: false, message: 'Payment update could not be saved' });
    return;
  }

  res.status(200).json({ success: true });
}
