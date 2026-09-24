import { describe, expect, it } from 'vitest';
import { sumOrderTotals, shippingPaiseFor, FREE_SHIPPING_ABOVE_PAISE } from '../pricing.service';

describe('order totals contract', () => {
  it('charges ₹49 delivery at or below ₹999 and frees it above', () => {
    expect(shippingPaiseFor(99900)).toBe(4900);
    expect(shippingPaiseFor(99901)).toBe(0);
    expect(shippingPaiseFor(0)).toBe(4900);
    expect(FREE_SHIPPING_ABOVE_PAISE).toBe(99900);
  });
  it('keeps the listed price as the final price with a contained tax slice', () => {
    // ₹19.99 × 3 at 18%: subtotal 5997p, contained tax round(5997×1800/11800)=915p.
    const totals = sumOrderTotals([{ totalPricePaise: 5997, taxRateBps: 1800, taxPaise: 915 }]);
    expect(totals).toEqual({ subtotalPaise: 5997, shippingPaise: 4900, taxPaise: 915, taxStatus: 'complete', totalPaise: 10897 });
  });
  it('flags lines without a configured rate instead of inventing tax', () => {
    const totals = sumOrderTotals([{ totalPricePaise: 100000, taxRateBps: undefined, taxPaise: 0 }]);
    expect(totals.taxStatus).toBe('incomplete');
    expect(totals.taxPaise).toBe(0);
    expect(totals.shippingPaise).toBe(0);
  });
  it('never charges delivery on an empty basket', () => {
    expect(sumOrderTotals([]).totalPaise).toBe(0);
  });
  it('rejects invalid money instead of totalling it', () => {
    expect(() => shippingPaiseFor(-1)).toThrow();
    expect(() => sumOrderTotals([{ totalPricePaise: -5, taxPaise: 0 }])).toThrow();
  });
});
