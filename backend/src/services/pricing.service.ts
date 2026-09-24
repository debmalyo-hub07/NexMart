import { includedProductTax } from '../utils/productTax';

/** Free delivery above an item total of ₹999, otherwise a flat ₹49. Paise in, paise out. */
export const FREE_SHIPPING_ABOVE_PAISE = 99900;
export const SHIPPING_FEE_PAISE = 4900;

export function shippingPaiseFor(subtotalPaise: number): number {
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 0) throw new Error('Invalid order subtotal.');
  return subtotalPaise > FREE_SHIPPING_ABOVE_PAISE ? 0 : SHIPPING_FEE_PAISE;
}

export interface PricedLine {
  totalPricePaise: number;
  taxRateBps?: number;
  taxPaise: number;
}

/** Single totals contract shared by checkout, invoices, and receipts: the
 * listed price already includes tax, so `taxPaise` is the contained slice
 * (see `includedProductTax`), never an addition. Mirrors the storefront
 * `calculateTotals` boundary cases — keep both suites green on any change. */
export function sumOrderTotals(lines: PricedLine[]): {
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  taxStatus: 'complete' | 'incomplete';
  totalPaise: number;
} {
  const subtotalPaise = lines.reduce((sum, line) => sum + line.totalPricePaise, 0);
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 0) throw new Error('Invalid order lines.');
  const taxPaise = lines.reduce((sum, line) => sum + line.taxPaise, 0);
  const taxStatus = lines.every(line => line.taxRateBps !== undefined) ? 'complete' : 'incomplete';
  const shippingPaise = lines.length === 0 ? 0 : shippingPaiseFor(subtotalPaise);
  return { subtotalPaise, shippingPaise, taxPaise, taxStatus, totalPaise: subtotalPaise + shippingPaise };
}

/** Contained-tax slice for one line total. Re-exported here so pricing
 * call sites import from one module. */
export function lineTax(totalPricePaise: number, rateBps?: number): number {
  return includedProductTax(totalPricePaise, rateBps);
}
