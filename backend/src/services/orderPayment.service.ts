import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { generateDeliveryId } from '../utils/helpers';
import { emitOrderStatusUpdate } from '../config/socket';
import { queueInvoiceGeneration } from '../queues/invoiceQueue';
import { sendOrderStatusEmail } from './email.service';
import { logger } from '../utils/logger';

/** Atomic across browser verification, webhook delivery and reconciliation.
 * A late capture records the money without reopening restocked/cancelled orders.
 */
export async function recordCapturedPayment(orderId: string, razorpayOrderId: string, paymentId: string) {
  const order = await Order.findOneAndUpdate(
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
    { new: true },
  );
  if (!order) return { order: await Order.findOne({ _id: orderId, razorpayOrderId }), changed: false };

  // A secondary notification outage must not turn a committed payment into an error.
  emitOrderStatusUpdate(order.customer.toString(), order.orderId, order.orderStatus);
  try { await queueInvoiceGeneration(String(order._id)); }
  catch (error) { logger.error('Paid order invoice could not be queued', error); }
  if (order.orderStatus === 'confirmed') {
    void Customer.findById(order.customer).select('name email').then(customer => {
      if (customer?.email) return sendOrderStatusEmail(customer.email, customer.name, order.orderId, 'confirmed');
    }).catch(error => logger.error('Payment confirmation email failed', error));
  }
  return { order, changed: true };
}
