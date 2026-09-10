'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, PackageOpen, Search } from 'lucide-react';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { QueryError } from '@/components/common/QueryError';
import { SearchBar } from '@/components/navbar/SearchBar';
import { GlowOrb } from '@/components/common/GlowOrb';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';

const HeroBackground = dynamic(
  () => import('@/components/common/HeroBackground').then((mod) => mod.HeroBackground),
  { ssr: false },
);

interface CategoryTile {
  _id: string;
  name: string;
  slug: string;
  parent?: { _id: string } | string | null;
  icon?: string;
  displayOrder: number;
}

interface ProductResponse {
  data?: Product[];
  meta?: { total?: number };
}

interface CategoryResponse {
  data?: CategoryTile[];
}

const categoryTints = [
  'from-violet-600/20 to-space-800',
  'from-acid-400/15 to-space-800',
  'from-amber-400/15 to-space-800',
  'from-blue-400/15 to-space-800',
];

export default function HomePage() {
  const featuredQuery = useQuery<ProductResponse>({
    queryKey: ['storefront', 'featured-products'],
    queryFn: () => api.get('/products?featured=true&limit=8').then((response) => response.data),
  });

  const categoriesQuery = useQuery<CategoryResponse>({
    queryKey: ['storefront', 'categories'],
    queryFn: () => api.get('/categories').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

  const products = featuredQuery.data?.data ?? [];
  const categories = (categoriesQuery.data?.data ?? [])
    .filter((category) => !category.parent)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 8);
  const leadProduct = products[0];
  const leadVariant = leadProduct?.variants?.[0];

  return (
    <main className="min-h-[100svh] overflow-x-clip bg-space-950">
      {/* No overflow-hidden here: it would clip the hero SearchBar's results
          dropdown (the input sits near the section's bottom edge). The glow
          orbs that overflow horizontally are clipped by main's overflow-x-clip. */}
      <section className="relative isolate border-b border-white/10">
        <Suspense fallback={<div className="absolute inset-0 bg-hero-gradient" aria-hidden />}>
          <HeroBackground />
        </Suspense>
        <div className="hero-grid absolute inset-0 -z-0 opacity-40" aria-hidden />
        <GlowOrb color="violet" size="lg" className="hero-glow -left-72 -top-64 opacity-25" />
        <GlowOrb color="acid" size="md" className="hero-glow -right-56 bottom-0 opacity-15" />

        <div className="page-container relative z-10 flex min-h-[clamp(34rem,calc(100dvh-var(--navbar-height)-2rem),48rem)] items-center py-10 sm:py-14 lg:py-20">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:gap-16">
            <div className="max-w-3xl">
              <p className="mb-5 text-meta font-semibold uppercase tracking-[0.22em] text-acid-400">
                NexMart / everyday commerce, considered
              </p>
              <h1 className="max-w-3xl font-outfit text-[clamp(2.75rem,8vw,6.75rem)] font-bold leading-[0.98] text-white">
                Find what fits
                <span className="block bg-brand-gradient bg-clip-text text-transparent">your next move.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                A focused catalog of useful products, clear prices, and delivery you can track from cart to door.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/products" className="btn-primary min-h-11 px-5 sm:px-6">
                  Browse products <ArrowRight size={17} aria-hidden />
                </Link>
                <Link href="#categories" className="btn-secondary min-h-11 px-5 sm:px-6">
                  Explore categories
                </Link>
              </div>

              <div className="mt-8 max-w-xl">
                <label htmlFor="home-search" className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
                  <Search size={15} className="text-violet-400" aria-hidden /> Search the catalog
                </label>
                <SearchBar id="home-search" />
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-space-800/70 p-5 backdrop-blur-md">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="text-meta font-semibold uppercase tracking-[0.18em] text-white/60">A considered start</p>
                  <span className="h-2 w-2 rounded-full bg-acid-400" aria-label="Catalog available" />
                </div>
                {leadProduct?.images?.[0] ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-space-700">
                    <Image
                      src={leadProduct.images[0]}
                      alt={leadProduct.name}
                      fill
                      priority
                      sizes="(min-width: 1024px) 35vw, 0px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-space-700 text-white/30">
                    <PackageOpen size={42} aria-hidden />
                  </div>
                )}
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-meta uppercase tracking-wider text-violet-300">Featured in the catalog</p>
                    <p className="mt-1 truncate font-outfit text-xl font-semibold text-white">{leadProduct?.name ?? 'Products worth comparing'}</p>
                  </div>
                  {leadVariant && <p className="shrink-0 font-mono text-sm text-acid-400">{formatPrice(leadVariant.price)}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="section scroll-mt-[var(--navbar-height)]">
        <div className="page-container">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.18em] text-violet-400">Start with a direction</p>
              <h2 className="mt-2 font-outfit text-3xl font-bold text-white sm:text-4xl">Shop by category</h2>
            </div>
            <Link href="/categories" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white">
              View all <ArrowRight size={15} aria-hidden />
            </Link>
          </div>

          {categoriesQuery.isError ? (
            <QueryError label="Categories" onRetry={() => void categoriesQuery.refetch()} />
          ) : categoriesQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label="Loading categories">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-xl border border-white/10 bg-white/[0.04] skeleton" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">Categories will appear here soon.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {categories.map((category, index) => (
                <Link
                  key={category._id || category.slug}
                  href={`/categories/${category.slug}`}
                  className={`group flex min-h-32 flex-col justify-between rounded-xl border border-white/10 bg-gradient-to-b ${categoryTints[index % categoryTints.length]} p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400`}
                >
                  <span className="text-3xl" aria-hidden>{category.icon || '•'}</span>
                  <span className="font-outfit text-sm font-semibold text-white">{category.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section border-y border-white/10 bg-space-900/70">
        <div className="page-container">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.18em] text-acid-400">Worth a closer look</p>
              <h2 className="mt-2 font-outfit text-3xl font-bold text-white sm:text-4xl">Featured products</h2>
              <p className="mt-2 text-sm text-white/60">Real inventory, transparent pricing, and no mystery claims.</p>
            </div>
            <Link href="/products?featured=true" className="hidden min-h-11 items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white sm:inline-flex">
              View all products <ArrowRight size={15} aria-hidden />
            </Link>
          </div>

          {featuredQuery.isError ? (
            <QueryError label="Featured products" onRetry={() => void featuredQuery.refetch()} />
          ) : featuredQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.03] p-10 text-center">
              <PackageOpen size={30} className="mx-auto mb-3 text-white/30" aria-hidden />
              <p className="font-outfit text-lg font-semibold text-white">No featured products yet</p>
              <p className="mt-1 text-sm text-white/60">Browse the full catalog to find your next favorite.</p>
              <Link href="/products" className="btn-primary mt-5 min-h-11">Browse catalog</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {products.map((product) => <ProductCard key={product._id} product={product} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="page-container">
          <div className="grid gap-8 border-t border-white/10 pt-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.18em] text-violet-400">Why NexMart</p>
              <h2 className="mt-3 max-w-md font-outfit text-3xl font-bold leading-tight text-white sm:text-4xl">A calmer way to choose what comes next.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                ['Compare clearly', 'Useful product details and prices stay in view while you browse.'],
                ['Buy with confidence', 'Your cart, checkout, and payment state are designed to recover gracefully.'],
                ['Track the handoff', 'Order status remains visible from confirmation through delivery.'],
              ].map(([title, copy]) => (
                <div key={title} className="border-l border-violet-500/40 pl-4">
                  <h3 className="font-outfit text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
