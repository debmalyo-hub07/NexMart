'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ProductCard } from '@/components/product/ProductCard';

/** Homepage rail of products viewed on this device. Renders nothing until it
 *  has read localStorage (no SSR mismatch) and nothing when history is empty. */
export function RecentlyViewed() {
  const { items, clear } = useRecentlyViewed();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !items.length) return null;
  return <section className="page-container pt-10" aria-labelledby="recently-viewed">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 id="recently-viewed" className="flex items-center gap-2 text-sm font-semibold"><History size={16} strokeWidth={1.75} aria-hidden />Recently viewed</h2>
        <p className="mt-1 text-xs text-muted">Saved in this browser only — never uploaded. Prices refresh on the product page.</p>
      </div>
      <button type="button" onClick={clear} className="min-h-11 text-xs font-medium text-[var(--accent-violet)] hover:underline">Clear history</button>
    </div>
    <div className="product-grid">{items.map(product => <ProductCard key={product._id} product={product} />)}</div>
  </section>;
}
