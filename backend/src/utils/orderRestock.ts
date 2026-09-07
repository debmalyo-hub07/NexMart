import { Product } from '../models/Product';
import { logger } from './logger';

// Shared restock helper (audit 2026-09-07 §3.2/§3.3/§3.4): every path that
// takes an order out of the fulfilment pipeline WITHOUT delivering goods —
// admin cancel, reaper cancel, failed online payment — must return the
// reserved stock. Delivery ('delivered') and genuine returns handled by the
// admin consume stock; everything else releases it.

export interface RestockableItem {
  product: unknown;
  variant: string;
  quantity: number;
}

export function restockQuantityForOrder(order: { items?: RestockableItem[] }): number {
  return (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/**
 * Restore every item's quantity to inventory. Never throws — a deleted
 * product or variant must not abort the caller's flow (same contract as the
 * reaper's inline loop, which this replaces).
 */
export async function restockOrderItems(order: { items?: RestockableItem[] }): Promise<void> {
  for (const item of order.items || []) {
    try {
      await Product.updateOne(
        { _id: item.product, 'variants.sku': item.variant },
        { $inc: { 'variants.$.stock': item.quantity } } as never
      );
    } catch (err) {
      logger.error(
        `Restock failed for product ${String(item.product)} (sku ${item.variant}):`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
