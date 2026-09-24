import mongoose, { ClientSession } from 'mongoose';
import { Product } from '../models/Product';
import { receiveReturnedSellerInventory, releaseSellerInventory } from '../services/marketplaceInventory.service';
import { logger } from './logger';
import { synchronizeFulfillmentGroups } from '../services/fulfillmentState.service';

// Every cancellation/failed-payment path returns reserved stock. A delivered
// return moves marketplace stock into the returned bucket until inspection;
// retail returns also stay unavailable until inspection.

export interface RestockableItem {
  product: unknown;
  variant: string;
  quantity: number;
  listing?: unknown;
  seller?: unknown;
  inventory?: unknown;
  inventoryState?: 'reserved' | 'committed' | 'released' | 'returned';
}

export interface RestockableOrder {
  _id?: unknown;
  orderId?: string;
  orderStatus?: string;
  items?: RestockableItem[];
  save?: (options?: { session?: ClientSession }) => Promise<unknown>;
}

export function restockQuantityForOrder(order: { items?: RestockableItem[] }): number {
  return (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

async function updateLegacyStock(order: RestockableOrder, session: ClientSession): Promise<boolean> {
  let changed = false;
  for (const item of order.items || []) {
    if (item.listing || !item.quantity) continue;
    // The item state is persisted with the order. This makes retries after a
    // successful stock update harmless, including reaper retries.
    if (item.inventoryState === 'released' || item.inventoryState === 'returned') continue;
    if (order.orderStatus === 'returned') {
      // Physical returns need inspection. Never put them straight back into
      // sellable retail inventory; an operator can restock after inspection.
      item.inventoryState = 'returned';
      changed = true;
      continue;
    }
    try {
      const update = await Product.updateOne(
        { _id: item.product, 'variants.sku': item.variant },
        { $inc: { 'variants.$.stock': item.quantity } },
        { session },
      );
      if (update.modifiedCount === 1) {
        item.inventoryState = 'released';
        changed = true;
      } else {
        logger.error(`Legacy restock target missing for product ${String(item.product)} (sku ${item.variant}).`);
      }
    } catch (err) {
      // Database failures must abort the order transition, allowing a safe
      // retry. A removed product is handled by modifiedCount above.
      logger.error(
        `Legacy restock failed for product ${String(item.product)} (sku ${item.variant}):`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }
  return changed;
}

/**
 * Restore every item's quantity to inventory. Marketplace lines use their
 * seller inventory and immutable movement keys; legacy lines use canonical
 * product stock. A deleted product/variant is logged and does not abort the
 * rest of the order's cleanup.
 */
export async function restockOrderItems(order: RestockableOrder, existingSession?: ClientSession): Promise<void> {
  const hasMarketplaceItems = (order.items || []).some((item) => Boolean(item.listing && item.seller));
  const restore = async (session: ClientSession) => {
      if (hasMarketplaceItems) {
        await synchronizeFulfillmentGroups(order, session);
        // A returned delivered parcel is no longer sellable by default. Its
        // committed quantity is recorded as returned pending inspection.
        if (order.orderStatus === 'returned') {
          await receiveReturnedSellerInventory(order, session);
        }
        await releaseSellerInventory(order, session);
      }
      await updateLegacyStock(order, session);
      // The terminal status/history and inventory item states commit together.
      if (order.save) await order.save({ session });
  };
  if (existingSession) await restore(existingSession);
  else await mongoose.connection.transaction(restore);
}
