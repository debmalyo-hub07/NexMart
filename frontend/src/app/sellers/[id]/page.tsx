'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, BadgeCheck, Star, MapPin, ArrowLeft, ArrowUpRight, Check, Info, Package, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import type { ApiResponse } from '@/types';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { formatPrice } from '@/lib/utils';
import { ProductImage } from '@/components/product/ProductImage';

type PublicSeller = {
  _id: string;
  storefrontName: string;
  legalBusinessName: string;
  verification: 'verified' | 'standard';
  performance?: { ratingAverage?: number; ratingCount?: number };
  businessAddress?: { city?: string; state?: string };
};

type SellerListingItem = {
  _id: string;
  canonicalVariantSku?: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  condition: 'new' | 'used' | 'refurbished';
  handlingTimeDays?: number;
  returnWindowDays?: number;
  canonicalProduct: { _id: string; name: string; slug: string; images?: string[] };
  inventory: { available: number };
};

type StorefrontData = {
  seller: PublicSeller;
  listings: SellerListingItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export default function SellerStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedPage = Number(searchParams.get('page') || '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['storefront', 'seller', id, page],
    queryFn: ({ signal }) => api.get<ApiResponse<StorefrontData>>('/seller/storefront/' + encodeURIComponent(id), { signal, params: { page, limit: 24 } }).then(response => response.data.data),
    staleTime: 30_000,
    placeholderData: previous => previous?.seller._id === id ? previous : undefined,
  });

  function changePage(nextPage: number) {
    const query = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) query.set('page', String(nextPage)); else query.delete('page');
    router.push('/sellers/' + encodeURIComponent(id) + (query.size ? '?' + query : ''), { scroll: false });
  }

  const backLink = <Link href="/products" className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary transition-colors hover:text-[var(--accent-violet)]"><ArrowLeft size={16} aria-hidden />Back to catalog</Link>;

  if (isPending) return <main id="main-content" className="store-page min-h-screen py-8">
    <div className="page-container space-y-6">
      {backLink}<p role="status" className="text-sm text-muted">Loading seller and product offers…</p>
      <div aria-hidden className="h-44 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
      <div aria-hidden className="catalog-grid">{[0, 1, 2, 3].map(index => <div key={index} className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />)}</div>
    </div>
  </main>;

  if (isError) return <main id="main-content" className="store-page min-h-screen py-8">
    <div className="page-container space-y-6">{backLink}<QueryError label="Seller storefront" detail={getApiError(error)} onRetry={() => void refetch()} /></div>
  </main>;

  if (!data?.seller) return <main id="main-content" className="store-page min-h-screen py-8">
    <div className="page-container">{backLink}<EmptyState icon={Store} title="Store not found" description="This seller store may have been paused or is currently inactive." action={<Link href="/products" className="btn-primary">Browse all products</Link>} /></div>
  </main>;

  const { seller, listings, pagination } = data;
  const reviewCount = seller.performance?.ratingCount ?? 0;
  return <main id="main-content" className="store-page min-h-screen py-8">
    <div className="page-container space-y-8">
      {backLink}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-8">
        <p className="eyebrow mb-5">Meet the seller</p>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--product-stage)]"><Store size={26} aria-hidden /></div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl sm:text-4xl">{seller.storefrontName}</h1>
              <p className="mt-2 break-words text-sm text-secondary">{seller.legalBusinessName}</p>
              {seller.verification === 'verified' && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-secondary"><BadgeCheck size={16} aria-hidden />Seller verification recorded</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-xs text-secondary">
                <span className="inline-flex items-center gap-1.5"><Star size={14} aria-hidden />{reviewCount > 0 && seller.performance?.ratingAverage !== undefined ? <>{seller.performance.ratingAverage.toFixed(1)} · {new Intl.NumberFormat('en-IN').format(reviewCount)} {reviewCount === 1 ? 'review' : 'reviews'}</> : 'No seller reviews yet'}</span>
                {seller.businessAddress?.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{[seller.businessAddress.city, seller.businessAddress.state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-[var(--border)] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="font-mono text-3xl tabular-nums">{new Intl.NumberFormat('en-IN').format(pagination.total)}</p>
            <p className="mt-1 text-xs text-muted">Published {pagination.total === 1 ? 'offer' : 'offers'}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4">
          <p className="max-w-2xl text-sm leading-relaxed text-secondary">Compare the selected option, condition and seller-stated terms before you order. Delivery, returns and warranty can vary by offer.</p>
          <Link href="/returns" className="inline-flex min-h-11 items-center gap-1.5 text-sm underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-violet)]">Read return information<ArrowUpRight size={16} aria-hidden /></Link>
        </div>
      </section>

      <section className="space-y-6" aria-busy={isFetching}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div><h2 className="text-xl sm:text-2xl">Explore this store</h2><p className="mt-2 text-sm text-muted">Published offers, ordered by price. Availability is checked again in your cart.</p></div>
          {isFetching && <p role="status" className="inline-flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" aria-hidden />Updating offers…</p>}
        </div>
        {!listings.length ? <EmptyState icon={Package} title={pagination.total ? 'No offers on this page' : 'No active listings'} description={pagination.total ? 'Return to the first page to browse this store.' : 'This seller does not have any product offers published right now.'} action={pagination.total ? <button type="button" className="btn-secondary" onClick={() => changePage(1)}>First page</button> : <Link href="/products" className="btn-secondary">Explore the catalog</Link>} /> : <div className="catalog-grid">
          {listings.map(item => {
            const product = item.canonicalProduct;
            const stock = item.inventory.available;
            const href = '/products/' + product.slug + (item.canonicalVariantSku ? '?option=' + encodeURIComponent(item.canonicalVariantSku) : '') + '#seller-offers';
            return <article key={item._id} className="product-tile">
              <Link href={href} className="product-stage relative block aspect-square" aria-label={'View seller options for ' + product.name}><ProductImage src={product.images?.[0]} alt={product.name} sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, 320px" className="p-4 sm:p-6" /></Link>
              <div className="flex flex-1 flex-col p-3 sm:p-5">
                <p className="text-xs capitalize text-muted">{item.condition} condition</p>
                <h3 className="mt-2 min-h-11 text-sm leading-snug sm:text-base"><Link href={href} className="line-clamp-2 hover:text-[var(--accent-violet-light)]">{product.name}</Link></h3>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-base font-medium sm:text-lg">{formatPrice(item.pricePaise / 100)}</span>
                  {item.compareAtPricePaise !== undefined && item.compareAtPricePaise > item.pricePaise && <del className="text-xs text-muted"><span className="sr-only">Seller compare-at price </span>{formatPrice(item.compareAtPricePaise / 100)}</del>}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary">{stock > 0 ? <Check size={13} className="text-acid-400" aria-hidden /> : <Info size={13} aria-hidden />}{stock > 0 ? 'Available from this seller' : 'Currently unavailable'}</p>
                {item.handlingTimeDays !== undefined && <p className="mt-3 text-xs leading-relaxed text-muted">Seller handling: {item.handlingTimeDays} {item.handlingTimeDays === 1 ? 'day' : 'days'}. Arrival date not guaranteed.</p>}
                <Link href={href} className="btn-secondary mt-4 w-full gap-1 px-2 text-xs sm:text-sm">View seller options<ArrowUpRight size={15} aria-hidden /></Link>
              </div>
            </article>;
          })}
        </div>}
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={changePage} />
      </section>
    </div>
  </main>;
}
