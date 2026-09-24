import { ClientSession } from 'mongoose';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { Shipment } from '../models/Shipment';
import { AppError } from '../middleware/errorHandler';

const dispatched = ['shipped', 'out_for_delivery', 'delivered'];
const progress: Record<string, number> = { placed: 0, confirmed: 1, processing: 2, ready_for_pickup: 3, shipped: 4, out_for_delivery: 5, delivered: 6 };

/** Whole-order operations must also move each live seller package, while
 * preserving packages already cancelled/returned and preventing regressions. */
export async function synchronizeFulfillmentGroups(order: { _id?: unknown; orderStatus?: string }, session: ClientSession): Promise<void> {
  if (!order._id || !order.orderStatus) return;
  const groups = await FulfillmentGroup.find({ order: order._id }).session(session);
  const active = groups.filter(group => !['cancelled', 'returned'].includes(group.status));
  if (order.orderStatus === 'cancelled' && active.some(group => dispatched.includes(group.status))) throw new AppError('A seller package has already been dispatched. Review its return options instead.', 409, true, 'FULFILLMENT_CONFLICT');
  if (dispatched.includes(order.orderStatus) && active.some(group => (progress[group.status] ?? -1) < progress.ready_for_pickup)) throw new AppError('All seller packages must be ready for pickup before dispatching this order.', 409, true, 'FULFILLMENT_NOT_READY');
  for (const group of active) {
    const target = order.orderStatus as typeof group.status;
    if (group.status === target) continue;
    if (progress[target] !== undefined && progress[group.status] >= progress[target]) continue;
    group.status = target;
    group.statusHistory.push({ status: target, timestamp: new Date(), note: 'Updated through order operations.' });
    await group.save({ session });
    const shipmentStatus: Record<string, string> = { shipped: 'in_transit', out_for_delivery: 'out_for_delivery', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned' };
    if (shipmentStatus[target]) {
      await Shipment.updateMany({ fulfillmentGroup: group._id, status: { $nin: ['cancelled', 'returned', 'delivered'] } }, {
        $set: { status: shipmentStatus[target] },
        $push: { handoffEvents: { event: shipmentStatus[target], timestamp: new Date(), note: 'Updated through order operations.' } },
        $inc: { __v: 1 },
      }, { session });
      if (target === 'returned') await Shipment.updateMany({ fulfillmentGroup: group._id, status: 'delivered' }, { $set: { status: 'returned' }, $push: { handoffEvents: { event: 'returned', timestamp: new Date() } }, $inc: { __v: 1 } }, { session });
    }
  }
}
