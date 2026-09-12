import { formatPrice } from '@/lib/utils';

export function OrderTotals({ totals }: { totals: { subtotal: number; shippingFee: number; tax: number; discount: number; total: number } }) {
  return <dl className="space-y-2 text-sm">
    <div className="flex justify-between gap-3 text-secondary"><dt>Subtotal</dt><dd className="font-mono">{formatPrice(totals.subtotal)}</dd></div>
    <div className="flex justify-between gap-3 text-secondary"><dt>Shipping</dt><dd className="font-mono">{totals.shippingFee === 0 ? 'Free' : formatPrice(totals.shippingFee)}</dd></div>
    <div className="flex justify-between gap-3 text-secondary"><dt>GST (18%)</dt><dd className="font-mono">{formatPrice(totals.tax)}</dd></div>
    {totals.discount > 0 && <div className="flex justify-between gap-3 text-secondary"><dt>Discount</dt><dd className="font-mono">−{formatPrice(totals.discount)}</dd></div>}
    <div className="flex flex-wrap justify-between gap-3 border-t border-white/15 pt-3 text-base font-semibold"><dt>Total</dt><dd className="break-words font-mono">{formatPrice(totals.total)}</dd></div>
  </dl>;
}
