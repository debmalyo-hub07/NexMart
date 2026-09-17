'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, BadgeCheck, Star, ShieldCheck, MapPin, ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { formatPrice } from '@/lib/utils';
import { ProductImage } from '@/components/product/ProductImage';

type PublicSeller = {
  _id: string;
  storefrontName: string;
  legalBusinessName: string;
  businessType: string;
  verification: string;
  performance?: {
    ratingAverage?: number;
    ratingCount?: number;
  };
  returnPolicy?: {
    acceptsReturns: boolean;
    returnWindowDays: number;
  };
  businessAddress?: {
    city?: string;
    state?: string;
  };
  createdAt: string;
};

type SellerListingItem = {
  _id: string;
  sellerSku: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  condition: string;
  canonicalProduct?: {
    _id: string;
    name: string;
    slug: string;
    images?: string[];
    description?: string;
  };
  inventory?: {
    available: number;
  };
};

type StorefrontData = {
  seller: PublicSeller;
  listings: SellerListingItem[];
};

export default function SellerStorefrontPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['seller', 'storefront', id],
    queryFn: async () => (await api.get(`/seller/storefront/${id}`)).data.data as StorefrontData,
  });

  if (isPending) {
    return (
      <main id="main-content" className="store-page min-h-screen py-8">
        <div className="page-container space-y-6">
          <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main id="main-content" className="store-page min-h-screen py-8">
        <div className="page-container">
          <QueryError
            label="Storefront"
            detail={getApiError(error)}
            onRetry={() => void refetch()}
          />
        </div>
      </main>
    );
  }

  if (!data?.seller) {
    return (
      <main id="main-content" className="store-page min-h-screen py-8">
        <div className="page-container">
          <EmptyState
            icon={Store}
            title="Store not found"
            description="This seller store may have been paused or is currently inactive."
            action={
              <Link href="/products" className="btn-primary">
                Browse all products
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const { seller, listings } = data;
  const isVerified = seller.verification === 'verified';

  return (
    <main id="main-content" className="store-page min-h-screen py-8">
      <div className="page-container space-y-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft size={16} aria-hidden /> Back to catalog
        </Link>

        {/* Storefront Hero Header */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-space-900 via-space-900/90 to-violet-950/20 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-600/20 text-violet-300">
                <Store size={32} aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-outfit text-2xl font-bold sm:text-3xl text-white">
                    {seller.storefrontName}
                  </h1>
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300 border border-violet-500/30">
                      <BadgeCheck size={14} /> Verified Merchant
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-secondary">
                  <span className="flex items-center gap-1">
                    <Star
                      size={14}
                      className={
                        seller.performance?.ratingAverage ? 'text-amber-400' : 'text-muted'
                      }
                    />
                    <span className="font-medium text-white">
                      {seller.performance?.ratingAverage
                        ? seller.performance.ratingAverage.toFixed(1)
                        : 'New Store'}
                    </span>
                    {seller.performance?.ratingCount ? (
                      <span className="text-muted">({seller.performance.ratingCount} reviews)</span>
                    ) : null}
                  </span>

                  {seller.businessAddress?.city && (
                    <span className="flex items-center gap-1 text-muted">
                      <MapPin size={13} />
                      {seller.businessAddress.city}, {seller.businessAddress.state || 'India'}
                    </span>
                  )}

                  {seller.returnPolicy?.acceptsReturns !== false && (
                    <span className="flex items-center gap-1 text-acid-400">
                      <ShieldCheck size={13} />
                      {seller.returnPolicy?.returnWindowDays || 14}-day returns
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center sm:text-right">
              <p className="text-xs text-muted">Active Catalog</p>
              <p className="mt-1 font-mono text-2xl font-bold text-white">
                {listings?.length || 0}
              </p>
              <p className="text-[11px] text-secondary">Published offers</p>
            </div>
          </div>
        </section>

        {/* Listings Showcase */}
        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="font-outfit text-xl font-semibold">Products from this seller</h2>
            <p className="text-xs text-secondary">Browse items stocked and dispatched by {seller.storefrontName}.</p>
          </div>

          {!listings?.length ? (
            <EmptyState
              icon={Package}
              title="No active listings"
              description="This seller does not have any active product offers published right now."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {listings.map((item) => {
                const product = item.canonicalProduct;
                if (!product) return null;
                const stock = item.inventory?.available || 0;

                return (
                  <article
                    key={item._id}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-space-900 p-4 transition-colors hover:border-white/20"
                  >
                    <div>
                      <div className="product-stage relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-white/5">
                        <ProductImage
                          src={product.images?.[0]}
                          alt={product.name}
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      </div>

                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary">
                        {item.condition}
                      </span>

                      <h3 className="mt-2 font-medium line-clamp-2 text-sm text-white">
                        <Link
                          href={`/products/${product.slug}`}
                          className="hover:text-violet-300 focus-visible:underline"
                        >
                          {product.name}
                        </Link>
                      </h3>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-lg font-semibold text-white">
                          {formatPrice(item.pricePaise / 100)}
                        </span>
                        {item.compareAtPricePaise && item.compareAtPricePaise > item.pricePaise && (
                          <del className="font-mono text-xs text-muted">
                            {formatPrice(item.compareAtPricePaise / 100)}
                          </del>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className={stock > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {stock > 0 ? (stock < 5 ? `Only ${stock} left` : 'In stock') : 'Out of stock'}
                        </span>
                        <Link
                          href={`/products/${product.slug}`}
                          className="text-violet-300 hover:underline"
                        >
                          View offer →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
