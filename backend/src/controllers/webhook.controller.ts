import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { Order } from '../models/Order';
import { logger } from '../utils/logger';
import { emitOrderStatusUpdate } from '../config/socket';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { generateDeliveryId } from '../utils/helpers';

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
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        if (payment?.id) order.razorpayPaymentId = payment.id;
        if (!order.deliveryId) order.deliveryId = generateDeliveryId();
        order.statusHistory.push({
          status: 'confirmed',
          timestamp: new Date(),
          updatedBy: order.customer,
          note: 'Confirmed via Razorpay webhook',
        } as any);
        await order.save();

        emitOrderStatusUpdate(order.customer.toString(), order.orderId, 'confirmed');
        await queueInvoiceGeneration(order._id.toString());
        logger.info(`Razorpay webhook: order ${order.orderId} marked paid (${type}).`);
      }
    } else if (rzpOrderId && type === 'payment.failed') {
      await Order.findOneAndUpdate(
        { razorpayOrderId: rzpOrderId, paymentStatus: 'pending' },
        { paymentStatus: 'failed' }
      );
      logger.info(`Razorpay webhook: order for ${rzpOrderId} marked failed.`);
    }
  } catch (err) {
    // We already verified the signature; log and still 200 so Razorpay does not hammer retries.
    logger.error('Razorpay webhook processing error:', err);
  }

  res.status(200).json({ success: true });
}
