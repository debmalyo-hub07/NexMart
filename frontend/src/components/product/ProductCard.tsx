'use client';

import { memo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Heart, Loader2, ShoppingCart, Star } from 'lucide-react';
import type { Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { getApiError } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductImage } from './ProductImage';

export const ProductCard = memo(function ProductCard({ product, className }: { product: Product; className?: string }) {
  const [adding, setAdding] = useState(false);
  const pending = useRef(false);
  const addItem = useCartStore(state => state.addItem);
  const cartBusy = useCartStore(state => state.isLoading);
  const showToast = useUIStore(state => state.showToast);
  const { isWishlisted, toggleWishlist, isLoading: wishlistLoading } = useWishlist();
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const variant = product.variants?.[0];
  const hasOptions = product.variants?.length > 1;
  const inStock = product.variants?.some(option => option.stock > 0);
  const discount = variant?.comparePrice && variant.comparePrice > variant.price ? Math.round((1 - variant.price / variant.comparePrice) * 100) : 0;
  const href = `/products/${product.slug}`;
  const saved = isWishlisted(product._id);

  async function add() {
    if (!variant || pending.current) return;
    pending.current = true;
    setAdding(true);
    try { await addItem(product._id, variant.sku); showToast('Added to your cart'); }
    catch (error) { showToast(getApiError(error), 'error'); }
    finally { pending.current = false; setAdding(false); }
  }

  return <article className={cn('relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-space-800 transition-colors hover:border-violet-300/50', className)}>
    <Link href={href} className="product-stage relative block aspect-square" aria-label={`View ${product.name}`}><ProductImage src={product.images?.[0]} alt={product.name} sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, 260px" className="p-3 sm:p-5" /></Link>
    {!admin && <button type="button" disabled={wishlistLoading} aria-label={`${saved ? 'Remove' : 'Save'} ${product.name}${saved ? ' from saved products' : ''}`} aria-pressed={saved} onClick={() => toggleWishlist(product._id)} className="icon-button absolute right-1 top-1 border border-white/15 bg-space-900 text-white hover:bg-space-700"><Heart size={18} className={saved ? 'fill-violet-200 text-violet-200' : ''} aria-hidden /></button>}
    <div className="flex flex-1 flex-col p-3 sm:p-4">
      <p className="truncate text-xs text-muted">{product.brand || product.category?.name || 'NexMart catalog'}</p>
      <h3 className="mt-1 min-h-[2.75rem] text-sm leading-snug sm:text-base"><Link href={href} className="line-clamp-2 break-words hover:text-violet-200">{product.name}</Link></h3>
      <div className="mt-2 flex min-h-5 items-center gap-1.5 text-xs text-secondary">{product.ratings?.count > 0 ? <><Star size={13} className="fill-amber-400 text-amber-400" aria-hidden /><span>{product.ratings.average.toFixed(1)} <span className="text-muted">({product.ratings.count})</span></span><span className="sr-only">out of 5 stars</span></> : <span className="text-muted">No reviews yet</span>}</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">{variant ? <span className="break-all font-mono text-[clamp(.875rem,2.4vw,1.125rem)] font-semibold tabular-nums">{formatPrice(variant.price)}</span> : <span className="text-sm text-muted">Unavailable</span>}{discount > 0 && <del className="text-xs text-muted"><span className="sr-only">MRP </span>{formatPrice(variant!.comparePrice!)}</del>}</div>
      {discount > 0 && <p className="mt-1 text-xs text-acid-300">{discount}% off</p>}
      <p className="mb-3 mt-2 flex items-center gap-1 text-xs text-secondary">{inStock ? <><Check size={13} className="shrink-0 text-acid-400" aria-hidden />{hasOptions ? 'Options in stock' : 'In stock'}</> : 'Out of stock'}</p>
      {admin ? <Link href={href} className="btn-secondary mt-auto w-full">View product</Link> : hasOptions ? <Link href={href} className="btn-secondary mt-auto w-full px-2 text-xs sm:text-sm">Choose options</Link> : <button type="button" disabled={adding || cartBusy || !variant || !inStock} onClick={() => void add()} className="btn-primary mt-auto w-full px-2 text-xs sm:text-sm">{adding ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ShoppingCart size={15} className="shrink-0" aria-hidden />}{adding ? 'Adding…' : !inStock ? 'Unavailable' : 'Add to cart'}</button>}
    </div>
  </article>;
});
