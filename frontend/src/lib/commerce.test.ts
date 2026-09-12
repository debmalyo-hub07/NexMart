import { describe, expect, it } from 'vitest';
import { calculateTotals, getCartItemState, selectVariant } from './commerce';
import { formatDate, formatPrice } from './utils';
import type { CartItem, ProductVariant } from '@/types';

describe('purchase information', () => {
  it('preserves paise from item prices through GST and the final amount', () => {
    expect(calculateTotals([{ price: 19.99, quantity: 3 }])).toEqual({ subtotal: 59.97, shippingFee: 49, tax: 10.79, discount: 0, total: 119.76 });
    expect(formatPrice(119.76)).toContain('119.76');
  });
  it('matches the server shipping threshold, including the boundary and an empty cart', () => {
    expect(calculateTotals([{ price: 999, quantity: 1 }]).shippingFee).toBe(49);
    expect(calculateTotals([{ price: 999.01, quantity: 1 }]).shippingFee).toBe(0);
    expect(calculateTotals([]).total).toBe(0);
  });
  it('retains an explicitly selected SKU even when a refresh reports it out of stock', () => {
    const variants = [{ sku: 'A', stock: 5 }, { sku: 'B', stock: 0 }] as ProductVariant[];
    expect(selectVariant(variants, 'B')?.sku).toBe('B');
    expect(selectVariant(variants, 'deleted')?.sku).toBe('A');
    expect(selectVariant([])).toBeUndefined();
  });
  it('surfaces a changed price and blocks a quantity that now exceeds stock', () => {
    const item = { price: 100, quantity: 3, variant: 'A', product: { variants: [{ sku: 'A', price: 120, stock: 2 }] } } as CartItem;
    expect(getCartItemState(item)).toMatchObject({ price: 120, priceChanged: true, available: false });
    expect(getCartItemState({ ...item, product: null })).toMatchObject({ available: false });
  });
  it('formats a timeline date with dateStyle and timeStyle without throwing', () => {
    expect(() => formatDate('2026-09-11T08:00:00Z', { dateStyle: 'medium', timeStyle: 'short' })).not.toThrow();
    expect(formatDate('invalid')).toBe('Date unavailable');
  });
});
