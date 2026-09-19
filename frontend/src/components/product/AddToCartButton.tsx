'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShoppingBag } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AddToCartButton({ product, variant, quantity = 1, className }: { product: Product; variant?: ProductVariant; quantity?: number; className?: string }) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useCartStore(store => store.isLoading);
  const addItem = useCartStore(store => store.addItem);
  const toast = useUIStore(store => store.showToast);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function add() {
    if (pending.current || busy || !variant || !variant.stock || product.isDemo) return;
    pending.current = true; setState('adding');
    try {
      await addItem(product._id, variant.sku, quantity);
      setState('added'); toast('Added to your cart');
      timer.current = setTimeout(() => setState('idle'), 2000);
    } catch (error) { setState('idle'); toast(getApiError(error), 'error'); }
    finally { pending.current = false; }
  }
  const unavailable = !variant?.stock || product.isDemo;
  return <button type="button" onClick={() => void add()} disabled={unavailable || busy || state === 'adding'} className={cn('btn-primary', className)}>
    {state === 'adding' ? <Loader2 size={17} className="animate-spin" aria-hidden /> : state === 'added' ? <Check size={17} aria-hidden /> : <ShoppingBag size={17} aria-hidden />}
    {product.isDemo ? 'Sample · not for sale' : unavailable ? 'Currently unavailable' : state === 'adding' ? 'Adding…' : state === 'added' ? 'Added to cart' : 'Add to cart'}
  </button>;
}
