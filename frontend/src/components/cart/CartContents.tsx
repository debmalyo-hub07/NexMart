'use client';

import Link from 'next/link';
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useOnline } from '@/hooks/useOnline';
import { getCartItemState, variantLabel } from '@/lib/commerce';
import { formatPrice } from '@/lib/utils';
import { ProductImage } from '@/components/product/ProductImage';
import { EmptyState } from '@/components/common/EmptyState';

export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const { items, error, notice, ready, isLoading, fetchCart, updateItem, removeItem } = useCartStore();
  const online = useOnline();
  return <div aria-busy={isLoading}>
    {error && <div role="alert" className="mb-4 rounded-xl border border-red-400/30 p-4 text-sm text-red-300"><p>{error}</p><p className="mt-1 text-secondary">Refresh to check the latest cart before continuing.</p><button type="button" className="btn-secondary mt-3" disabled={isLoading || !online} onClick={() => void fetchCart()}>Refresh cart</button></div>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-amber-400/30 p-3 text-sm text-amber-200">{notice}</p>}
    {isLoading && <p role="status" className="mb-3 flex items-center gap-2 text-sm text-secondary"><Loader2 size={16} className="animate-spin" aria-hidden />Updating cart…</p>}
    {!ready && !error && !items.length ? <p className="py-6 text-sm text-secondary" role="status">Loading your cart…</p> : ready && !items.length && !error ? <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Explore the catalog and add a product when you find the right option." action={<Link href="/products" onClick={onNavigate} className="btn-primary">Browse products</Link>} /> : <ul className="divide-y divide-white/10">{items.map(item => {
      const state = getCartItemState(item);
      const name = item.product?.name || 'Unavailable product';
      const href = item.product?.slug ? `/products/${item.product.slug}` : undefined;
      return <li key={item._id} className="flex gap-3 py-4 first:pt-0">
        <div className="product-stage relative h-16 w-16 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20"><ProductImage src={state.variant?.images?.[0] || item.product?.images?.[0]} alt="" sizes="80px" className="p-1" /></div>
        <div className="min-w-0 flex-1"><h3 className="break-words text-sm leading-snug">{href ? <Link href={href} onClick={onNavigate} className="hover:text-violet-200">{name}</Link> : name}</h3><p className="mt-1 break-words text-xs text-muted">{state.variant ? variantLabel(state.variant) : item.variant}</p>
          <p className="mt-2 font-mono text-sm">{formatPrice(state.price)} <span className="font-inter text-xs text-muted">each</span></p>
          {state.priceChanged && <p className="mt-1 text-sm text-amber-200">Price changed from {formatPrice(item.price)} to {formatPrice(state.price)}. Review the updated total.</p>}
          {state.reason && <p className="mt-1 text-sm text-red-300">{state.reason}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2"><div className="flex items-center rounded-xl border border-white/30"><button type="button" className="icon-button" aria-label={`Decrease quantity of ${name}`} disabled={isLoading || !online || item.quantity <= 1 || !state.variant} onClick={() => void updateItem(item._id, item.quantity - 1)}><Minus size={16} aria-hidden /></button><span className="min-w-6 text-center font-mono text-sm" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span><button type="button" className="icon-button" aria-label={`Increase quantity of ${name}`} disabled={isLoading || !online || item.quantity >= Math.min(10, state.variant?.stock ?? 0)} onClick={() => void updateItem(item._id, item.quantity + 1)}><Plus size={16} aria-hidden /></button></div><button type="button" className="icon-button ml-auto text-red-300" aria-label={`Remove ${name} from cart`} disabled={isLoading || !online} onClick={() => void removeItem(item._id)}><Trash2 size={17} aria-hidden /></button></div>
        </div>
      </li>;
    })}</ul>}
  </div>;
}
