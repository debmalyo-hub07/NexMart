import { describe, it, expect } from 'vitest';
import { restockOrderItems, restockQuantityForOrder } from '../orderRestock';

describe('restockOrderItems (audit §3.2b/§3.3: every cancel/failed path must restock)', () => {
  it('computes the total restock quantity for an order', () => {
    const order = {
      items: [
        { product: 'p1', variant: 'sku1', quantity: 2 },
        { product: 'p2', variant: 'sku2', quantity: 3 },
      ],
    } as any;
    expect(restockQuantityForOrder(order)).toBe(5);
  });

  it('handles orders with no items (defensive, never throws)', () => {
    expect(restockQuantityForOrder({ items: [] } as any)).toBe(0);
  });
});
