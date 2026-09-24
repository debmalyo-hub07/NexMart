import mongoose, { ClientSession } from 'mongoose';
import { IOrder } from '../types';
import { AppError } from '../middleware/errorHandler';
import { restockOrderItems } from '../utils/orderRestock';
import { commitSellerInventory } from './marketplaceInventory.service';
import { recordCodCaptureLedger } from './marketplaceLedger.service';
import { synchronizeFulfillmentGroups } from './fulfillmentState.service';

/** The order, stock, package state, cash collection ledger and optional
 * delivery assignment are one commit. Optimistic concurrency rejects stale
 * operator views instead of overwriting a cancellation or a payment update. */
export async function persistOrderLifecycle(order: IOrder, relatedWrite?: (session: ClientSession) => Promise<unknown>): Promise<void> {
  const terminal = ['cancelled', 'returned'].includes(order.orderStatus);
  if (!terminal && order.paymentMethod === 'online' && order.paymentStatus !== 'paid') throw new AppError('Capture the online payment before progressing this order.', 409, true, 'PAYMENT_NOT_CAPTURED');
  await mongoose.connection.transaction(async session => {
    if (terminal) await restockOrderItems(order, session);
    else {
      await synchronizeFulfillmentGroups(order, session);
      if (['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) await commitSellerInventory(order, session);
      if (order.orderStatus === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'paid') await recordCodCaptureLedger(order, 'system', session);
      await order.save({ session });
    }
    if (relatedWrite) await relatedWrite(session);
  });
}
