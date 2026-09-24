'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Tag } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { ApiResponse, Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryError } from '@/components/common/QueryError';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';

// Price ceilings in rupees. Every band is also a plain link to the catalog,
// so the tool keeps working navigation even before its JS runs.
const BANDS: Array<{ max: number; label: string }> = [
  { max: 499, label: 'Under ₹499' },
  { max: 999, label: 'Under ₹999' },
  { max: 1999, label: 'Under ₹1,999' },
  { max: 4999, label: 'Under ₹4,999' },
  { max: 9999, label: 'Under ₹9,999' },
  { max: 24999, label: 'Under ₹24,999' },
];

function BudgetResults({ max }: { max: number }) {
  const query = useQuery<ApiResponse<Product[]>>({
    queryKey: ['storefront', 'budget', max],
    queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>(`/products?maxPrice=${max}&sort=price&limit=12&page=1`, { signal }).then(response => response.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const products = query.data?.data ?? [];
  const total = query.data?.meta?.total;
  const band = BANDS.find(item => item.max === max);
  return <section aria-live="polite" aria-busy={query.isFetching} className="mt-8">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{band ? band.label : 'Your budget'}{typeof total === 'number' && !query.isPending && <span className="ml-2 text-sm font-normal text-muted">{total} {total === 1 ? 'match' : 'matches'}</span>}</h2>
      <Link href={`/products?maxPrice=${max}&sort=price`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--accent-violet)]">See all matches in the catalog <ArrowUpRight size={15} aria-hidden /></Link>
    </div>
    {query.isError ? <QueryError label="Budget results" onRetry={() => void query.refetch()} />
      : query.isPending ? <div className="product-grid">{Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>
      : !products.length ? <EmptyState icon={Tag} title="Nothing under that budget yet" description="Try a higher budget band, or browse the full catalog for the current selection." action={<Link href="/products" className="btn-primary">Browse products</Link>} />
      : <div className="product-grid">{products.map(product => <ProductCard key={product._id} product={product} />)}</div>}
  </section>;
}

export function BudgetTool() {
  const searchParams = useSearchParams();
  const requested = Number(searchParams.get('maxPrice'));
  const max = BANDS.some(band => band.max === requested) ? requested : 1999;
  return <div>
    <nav aria-label="Choose a budget" className="flex flex-wrap gap-2">
      {BANDS.map(band => {
        const active = band.max === max;
        return <Link key={band.max} href={`/budget?maxPrice=${band.max}`} aria-current={active ? 'true' : undefined}
          className={`min-h-11 rounded-full border px-5 py-2 text-sm font-medium transition-colors ${active ? 'border-[var(--accent-violet)] bg-[var(--accent-violet)] text-white' : 'border-[var(--border-control)] bg-white text-secondary hover:border-[var(--accent-violet)] hover:text-[var(--accent-violet)]'}`}
          onClick={event => {
            // Same URL as the current band: follow the native link instead of
            // letting the client router swallow a no-op navigation.
            if (active) event.preventDefault();
          }}>{band.label}</Link>;
      })}
    </nav>
    <p className="mt-4 text-xs leading-relaxed text-muted">All NexMart prices include GST. Delivery is ₹49 below a ₹999 item subtotal and free above it. Budget bands cap the item price before delivery.</p>
    <Suspense fallback={<div className="product-grid mt-8">{Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>}>
      <BudgetResults max={max} />
    </Suspense>
  </div>;
}
