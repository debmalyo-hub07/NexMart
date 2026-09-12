'use client';

import Link from 'next/link';
import { ArrowRight, Check, PackageOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { categoryQueryOptions, featuredQueryOptions, rootCategories } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';
import { type Category, type Product } from '@/types';
import { SearchBar } from '@/components/navbar/SearchBar';
import { ProductImage } from '@/components/product/ProductImage';
import { CategoryIcon } from '@/components/product/CategoryIcon';
import { ProductCard } from '@/components/product/ProductCard';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/SkeletonLoader';

export function HomeDiscovery({ categories }: { categories?: Category[] }) {
  const query = useQuery({ ...categoryQueryOptions, initialData: categories });
  return <>
    <div className="mt-6"><label htmlFor="home-search" className="field-label">What are you looking for?</label><SearchBar id="home-search" /></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><Link href="/products" className="btn-primary">Browse products <ArrowRight size={17} aria-hidden /></Link><Link href="/categories" className="inline-flex min-h-11 items-center text-sm text-secondary hover:text-white">All categories</Link></div>
    <div className="mt-6 border-t border-white/10 pt-4">
      {query.isError ? <QueryError label="Categories" onRetry={() => void query.refetch()} /> : query.isPending ? <Skeleton className="h-12 w-full" /> : <nav aria-label="Shop by category" className="flex gap-2 overflow-x-auto pb-2">
        {rootCategories(query.data ?? []).map(category => <Link key={category._id} href={`/categories/${category.slug}`} className="flex min-h-12 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-secondary transition-colors hover:border-violet-300/50 hover:text-white"><CategoryIcon name={category.name} size={18} />{category.name}</Link>)}
      </nav>}
    </div>
  </>;
}

export function HomeSpotlight({ products }: { products?: Product[] }) {
  const query = useQuery({ ...featuredQueryOptions, initialData: products });
  if (query.isError) return <QueryError label="Featured product" onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Skeleton className="aspect-[4/5] max-h-[510px] rounded-2xl" />;
  const product = query.data?.[0];
  if (!product) return <EmptyState title="Explore the catalog" description="Featured products will appear here when they are available." icon={PackageOpen} action={<Link href="/products" className="btn-secondary">See all products</Link>} />;
  const variant = product.variants?.[0];
  return <article className="overflow-hidden rounded-2xl border border-white/15 bg-space-800">
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="eyebrow text-violet-200">In the spotlight</span><span className="text-xs text-muted">{product.brand || product.category?.name}</span></div>
    <Link href={`/products/${product.slug}`} className="product-stage relative block aspect-[4/3] sm:aspect-[5/4]" aria-label={`View ${product.name}`}>
      <ProductImage src={product.images?.[0]} alt={product.name} sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), 480px" priority className="p-4 sm:p-7" />
    </Link>
    <div className="p-4 sm:p-5">
      <h2 className="text-xl leading-snug sm:text-2xl"><Link href={`/products/${product.slug}`} className="hover:text-violet-200">{product.name}</Link></h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>{variant ? <p className="text-2xl font-semibold tabular-nums">{formatPrice(variant.price)}</p> : <p className="text-muted">Currently unavailable</p>}
          {variant && <p className="mt-1 flex items-center gap-1 text-xs text-secondary">{variant.stock > 0 && <Check size={13} className="text-acid-400" aria-hidden />}{variant.stock > 0 ? 'In stock' : 'Out of stock'}<span aria-hidden> · </span>Tax calculated at checkout</p>}
        </div>
        <Link href={`/products/${product.slug}`} className="btn-secondary">View product <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </div>
  </article>;
}

export function HomeMoreProducts({ products }: { products?: Product[] }) {
  const query = useQuery({ ...featuredQueryOptions, initialData: products });
  const more = query.data?.slice(1) ?? [];
  if (!more.length) return null;
  return <section className="section border-t border-white/10"><div className="page-container">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><h2 className="section-heading">More to discover</h2><Link href="/products?featured=true" className="btn-secondary">View featured products <ArrowRight size={16} aria-hidden /></Link></div>
    <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{more.map(product => <ProductCard key={product._id} product={product} />)}</div>
  </div></section>;
}
