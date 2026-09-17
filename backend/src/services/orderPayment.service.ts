import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import mongoose from 'mongoose';
import { generateDeliveryId } from '../utils/helpers';
import { emitOrderStatusUpdate } from '../config/socket';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { sendOrderStatusEmail } from './email.service';
import { logger } from '../utils/logger';
import { commitSellerInventory } from './marketplaceInventory.service';
import { recordPaymentCaptureLedger } from './marketplaceLedger.service';
import type { LedgerSource } from '../models/MarketplaceLedgerEntry';
import type { IOrder } from '../types';

/** Atomic across browser verification, webhook delivery and reconciliation.
 * A late capture records the money without reopening restocked/cancelled orders.
 */
export async function recordCapturedPayment(orderId: string, razorpayOrderId: string, paymentId: string, source: LedgerSource = 'payment_verify', correlationId?: string): Promise<{ order: IOrder | null; changed: boolean }> {
  const session = await mongoose.startSession();
  let order: IOrder | null = null;
  try {
    await session.withTransaction(async () => {
      order = await Order.findOneAndUpdate(
        { _id: orderId, razorpayOrderId, paymentMethod: 'online', paymentStatus: { $in: ['pending', 'failed'] } },
        [{ $set: {
          __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] },
          paymentStatus: 'paid',
          razorpayPaymentId: { $literal: paymentId },
          deliveryId: { $ifNull: ['$deliveryId', { $literal: generateDeliveryId() }] },
          statusHistory: { $cond: [
            { $eq: ['$orderStatus', 'placed'] },
            { $concatArrays: [{ $ifNull: ['$statusHistory', []] }, [{ status: 'confirmed', timestamp: new Date(), updatedBy: '$customer', note: 'Payment confirmed' }]] },
            '$statusHistory',
          ] },
          orderStatus: { $cond: [{ $eq: ['$orderStatus', 'placed'] }, 'confirmed', '$orderStatus'] },
        } }],
        { new: true, session },
      ) as IOrder | null;
      if (!order) return;
      // A late capture for a cancelled/returned order records the payment but
      // must not resurrect stock that has already been released.
      if (!['cancelled', 'returned'].includes(order.orderStatus)) {
        await commitSellerInventory(order, session);
      }
      // The append-only ledger is written in the same transaction as the
      // authoritative payment transition. A duplicate callback never reaches
      // this branch because the payment status predicate above is atomic.
      await recordPaymentCaptureLedger(order, paymentId, source, session, correlationId);
    });
  } finally {
    await session.endSession();
  }
  if (!order) return { order: await Order.findOne({ _id: orderId, razorpayOrderId }), changed: false };
  const capturedOrder = order as IOrder;

  // A secondary notification outage must not turn a committed payment into an error.
  emitOrderStatusUpdate(capturedOrder.customer.toString(), capturedOrder.orderId, capturedOrder.orderStatus);
  try { await queueInvoiceGeneration(String(capturedOrder._id)); }
  catch (error) { logger.error('Paid order invoice could not be queued', error); }
  if (capturedOrder.orderStatus === 'confirmed') {
    void Customer.findById(capturedOrder.customer).select('name email').then(customer => {
      if (customer?.email) return sendOrderStatusEmail(customer.email, customer.name, capturedOrder.orderId, 'confirmed');
    }).catch(error => logger.error('Payment confirmation email failed', error));
  }
  return { order: capturedOrder, changed: true };
}
