'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryError } from '@/components/common/QueryError';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { ProductCard } from '@/components/product/ProductCard';

export default function WishlistPage() {
  const query = useWishlist();
  const missing = query.productIds.filter(id => !query.products.some(product => product._id === id));
  return <main id="main-content" className="store-page"><div className="page-container"><PageHeader title="Saved products" description="Keep products here while you compare your options." />
    {query.isError ? <QueryError label="Saved products" onRetry={() => void query.refetch()} /> : query.isLoading && !query.products.length ? <div className="product-grid">{Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)}</div> : !query.productIds.length ? <EmptyState icon={Heart} title="Nothing saved yet" description="Use the heart on a product to save it for later." action={<Link href="/products" className="btn-primary">Explore products</Link>} /> : <>
      <div className="product-grid">{query.products.map(product => <ProductCard key={product._id} product={product} />)}</div>
      {missing.length > 0 && <section className="mt-6 space-y-3"><h2 className="text-xl">No longer in the catalog</h2><p className="text-sm text-secondary">Some saved products are unavailable.</p>{missing.map(id => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 p-4"><span className="text-sm text-muted">Unavailable saved product</span><button type="button" className="btn-secondary" disabled={query.isLoading} onClick={() => query.toggleWishlist(id)}>Remove saved item</button></div>)}</section>}
    </>}
  </div></main>;
}
