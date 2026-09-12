'use client';

import { memo } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { calculateTotals, getCartItemState } from '@/lib/commerce';
import { useOnline } from '@/hooks/useOnline';
import { Overlay } from '@/components/common/Overlay';
import { CartContents } from '@/components/cart/CartContents';
import { OrderTotals } from '@/components/cart/OrderTotals';

export const CartDrawer = memo(function CartDrawer() {
  const { items, isOpen, setOpen, isLoading, ready, error } = useCartStore();
  const online = useOnline();
  const blocked = isLoading || !ready || !!error || !online || items.some(item => !getCartItemState(item).available);
  const totals = calculateTotals(items.map(item => ({ price: getCartItemState(item).price, quantity: item.quantity })));
  const close = () => setOpen(false);
  return <Overlay open={isOpen} onClose={close} title="Your cart" variant="drawer" footer={items.length > 0 && <div className="space-y-3">
    <OrderTotals totals={totals} />
    {blocked ? <p className="text-sm text-secondary">Review the cart updates before checkout.</p> : <Link href="/checkout" onClick={close} className="btn-primary w-full">Continue to checkout</Link>}
    <Link href="/cart" onClick={close} className="btn-secondary w-full">Review full cart</Link>
  </div>}><CartContents onNavigate={close} /></Overlay>;
});
