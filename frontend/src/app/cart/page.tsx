'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { calculateTotals, getCartItemState } from '@/lib/commerce';
import { useOnline } from '@/hooks/useOnline';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CartContents } from '@/components/cart/CartContents';
import { OrderTotals } from '@/components/cart/OrderTotals';

export default function CartPage() {
  const { items, clearCart, ready, error, isLoading } = useCartStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const online = useOnline();
  const blocked = isLoading || !ready || !!error || !online || items.some(item => !getCartItemState(item).available);
  const totals = calculateTotals(items.map(item => ({ price: getCartItemState(item).price, quantity: item.quantity })));
  return <main id="main-content" className="store-page"><div className="page-container">
    <PageHeader title="Your shopping cart" description="Review your options, quantities, and the complete total before checkout." />
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0" aria-label="Cart items"><CartContents />{items.length > 0 && <button type="button" className="btn-secondary mt-4 text-red-300" disabled={isLoading || !online} onClick={() => setConfirmClear(true)}>Clear cart</button>}</section>
      {items.length > 0 && <aside className="card h-fit space-y-5 lg:sticky lg:top-24" aria-label="Order summary"><h2 className="text-xl">Order summary</h2><OrderTotals totals={totals} /><p className="text-xs text-muted">Shipping is free on a product subtotal above ₹999. GST is calculated at 18%.</p>{blocked ? <p className="text-sm text-amber-200" role="status">Resolve the cart updates above before continuing.</p> : <Link href="/checkout" className="btn-primary w-full">Continue to checkout</Link>}<Link href="/products" className="btn-secondary w-full">Continue shopping</Link></aside>}
    </div>
    <ConfirmDialog open={confirmClear} onCancel={() => setConfirmClear(false)} onConfirm={async () => { await clearCart(); setConfirmClear(false); }} title="Clear your cart?" description="All items will be removed from this cart." confirmLabel="Clear cart" isLoading={isLoading} variant="danger" />
  </div></main>;
}
