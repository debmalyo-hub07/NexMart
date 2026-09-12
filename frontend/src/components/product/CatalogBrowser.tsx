'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import api from '@/lib/api';
import { catalogParams, CATALOG_SORTS } from '@/lib/catalogFilters';
import { categoryQueryOptions, parentId, rootCategories } from '@/lib/catalog';
import type { ApiResponse, Category, Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { Overlay } from '@/components/common/Overlay';

function Filters({ params, categories, categorySlug, apply }: { params: URLSearchParams; categories: Category[]; categorySlug?: string; apply: (values: Record<string, string>) => void }) {
  const id = useId();
  const [error, setError] = useState('');
  return <form key={params.toString()} className="space-y-5" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minPrice = String(data.get('minPrice') || '');
    const maxPrice = String(data.get('maxPrice') || '');
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) { setError('Maximum price must be at least the minimum price.'); return; }
    setError('');
    apply({ category: categorySlug || String(data.get('category') || ''), minPrice, maxPrice, rating: String(data.get('rating') || ''), inStock: data.get('inStock') ? 'true' : '', featured: data.get('featured') ? 'true' : '' });
  }}>
    {!categorySlug && <div><label className="field-label" htmlFor={`${id}-category`}>Category</label><select className="input" name="category" id={`${id}-category`} defaultValue={params.get('category') || ''}><option value="">All categories</option>{rootCategories(categories).map(category => <optgroup key={category._id} label={category.name}><option value={category.slug}>{category.name} — all</option>{categories.filter(child => parentId(child) === category._id && child.isActive !== false).map(child => <option key={child._id} value={child.slug}>{child.name}</option>)}</optgroup>)}</select></div>}
    <fieldset><legend className="field-label">Price in rupees</legend><div className="grid grid-cols-2 gap-2">
      <div><label htmlFor={`${id}-min`} className="field-label text-xs">Minimum</label><input className="input" id={`${id}-min`} name="minPrice" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" defaultValue={params.get('minPrice') || ''} /></div>
      <div><label htmlFor={`${id}-max`} className="field-label text-xs">Maximum</label><input className="input" id={`${id}-max`} name="maxPrice" type="number" inputMode="decimal" min="0" step="0.01" placeholder="No limit" defaultValue={params.get('maxPrice') || ''} /></div>
    </div>{error && <p role="alert" className="field-error">{error}</p>}</fieldset>
    <div><label className="field-label" htmlFor={`${id}-rating`}>Customer rating</label><select className="input" id={`${id}-rating`} name="rating" defaultValue={params.get('rating') || ''}><option value="">Any rating</option><option value="4">4 stars & above</option><option value="3">3 stars & above</option></select></div>
    <div><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="inStock" defaultChecked={params.get('inStock') === 'true'} className="h-5 w-5 accent-violet-500" />In stock only</label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="featured" defaultChecked={params.get('featured') === 'true'} className="h-5 w-5 accent-violet-500" />Featured products</label></div>
    <button type="submit" className="btn-primary w-full">Apply filters</button>
  </form>;
}

export function CatalogBrowser({ mode = 'products', categorySlug }: { mode?: 'products' | 'search'; categorySlug?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = catalogParams(searchParams, categorySlug);
  const q = params.get('q') || '';
  const page = Number(params.get('page'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useQuery(categoryQueryOptions);
  const category = useQuery({
    queryKey: ['storefront', 'category', categorySlug],
    queryFn: ({ signal }) => api.get<ApiResponse<Category>>(`/categories/${encodeURIComponent(categorySlug!)}`, { signal }).then(r => r.data.data),
    enabled: !!categorySlug,
    staleTime: 60_000,
  });
  const needsQuery = mode !== 'search' || !!q;
  const query = useQuery<ApiResponse<Product[]>>({
    queryKey: ['storefront', 'products', params.toString()],
    queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>(`${q ? '/search' : '/products'}?${params}`, { signal }).then(r => r.data),
    enabled: needsQuery && (!categorySlug || !!category.data),
    placeholderData: keepPreviousData,
  });
  function update(values: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    if (resetPage) next.delete('page');
    router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }
  function clear() { update({ minPrice: '', maxPrice: '', rating: '', inStock: '', featured: '', category: '' }); }
  const applied = [
    ['category', categorySlug ? '' : (categories.data?.find(item => item.slug === params.get('category') || item._id === params.get('category'))?.name || params.get('category'))],
    ['minPrice', params.has('minPrice') ? `Min ₹${params.get('minPrice')}` : ''],
    ['maxPrice', params.has('maxPrice') ? `Max ₹${params.get('maxPrice')}` : ''],
    ['rating', params.has('rating') ? `${params.get('rating')}+ stars` : ''],
    ['inStock', params.has('inStock') ? 'In stock' : ''],
    ['featured', params.has('featured') ? 'Featured' : ''],
  ].filter(([, value]) => value);
  const title = categorySlug ? category.data?.name || 'Category' : mode === 'search' ? q ? `Results for “${q}”` : 'Search the catalog' : 'All products';
  const filterContent = <>
    {categories.isError && <QueryError label="Category filters" onRetry={() => void categories.refetch()} />}
    <Filters params={params} categories={categories.data ?? []} categorySlug={categorySlug} apply={values => { update(values); setFiltersOpen(false); }} />
  </>;

  return <main id="main-content" className="store-page"><div className="page-container">
    <PageHeader title={title} eyebrow={categorySlug ? 'Shop by category' : 'Explore NexMart'} description={category.data?.description || 'Compare products, prices, and options. Find what fits your needs.'} />
    <form role="search" className="mb-6 flex gap-2" onSubmit={event => { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get('q') || '').trim() }); }}>
      <label htmlFor="catalog-query" className="sr-only">Search the catalog</label><input key={q} id="catalog-query" name="q" type="search" defaultValue={q} maxLength={200} placeholder="Search products or brands…" className="input min-w-0 max-w-xl" autoComplete="off" enterKeyHint="search" /><button type="submit" className="btn-primary shrink-0 px-4"><Search size={18} aria-hidden /><span className="hidden sm:inline">Search</span><span className="sr-only sm:hidden">Search</span></button>
    </form>
    {categorySlug && category.isError ? <QueryError label="Category" onRetry={() => void category.refetch()} /> : <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17} aria-hidden />Filters{applied.length ? ` (${applied.length})` : ''}</button>
        <p className="text-sm text-secondary" role="status">{!needsQuery ? 'Enter a product name to begin' : query.isError ? 'Products unavailable' : query.isFetching || categorySlug && category.isPending ? 'Updating results…' : `${query.data?.meta?.total ?? 0} products`}</p>
        <div className="flex min-w-0 items-center gap-2"><label htmlFor="catalog-sort" className="text-sm text-secondary">Sort</label><select id="catalog-sort" value={params.get('sort') || ''} onChange={event => update({ sort: event.target.value })} className="input max-w-[190px]"><option value="">{q ? 'Most relevant' : 'Newest first'}</option>{CATALOG_SORTS.filter(option => q || option.value !== '-createdAt').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      </div>
      {applied.length > 0 && <div className="mb-5 flex flex-wrap gap-2" aria-label="Applied filters">{applied.map(([key, label]) => <button type="button" key={key} className="btn-secondary min-h-11 gap-2 px-3 text-xs" onClick={() => update({ [key!]: '' })} aria-label={`Remove ${label} filter`}>{label}<X size={14} aria-hidden /></button>)}<button type="button" className="min-h-11 px-3 text-sm text-secondary underline" onClick={clear}>Clear filters</button></div>}
      <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Catalog filters" className="hidden space-y-4 border-r border-white/10 pr-6 lg:block"><h2 className="text-lg">Filter products</h2>{filterContent}</aside>
        <section className="min-w-0" aria-label="Products" aria-busy={query.isFetching}>
          {!needsQuery ? <EmptyState title="Find your next product" description="Search by product name or brand, or explore the categories." icon={Search} action={<Link href="/categories" className="btn-secondary">Browse categories</Link>} />
            : query.isError ? <QueryError label="Products" onRetry={() => void query.refetch()} />
            : query.isPending || categorySlug && category.isPending ? <div className="product-grid">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
            : !query.data?.data?.length ? <EmptyState title="No matching products" description="Try another spelling, remove a filter, or explore another category." action={<><button className="btn-secondary" type="button" onClick={clear}>Clear filters</button><Link href="/categories" className="btn-primary">Browse categories</Link></>} />
            : <div className="product-grid">{query.data.data.map(product => <ProductCard key={product._id} product={product} />)}</div>}
          {!query.isError && (query.data?.meta?.totalPages ?? 0) > 1 && <div className="mt-8"><Pagination page={page} totalPages={query.data!.meta!.totalPages} onPageChange={next => { update({ page: String(next) }, false); window.scrollTo({ top: 0 }); }} /></div>}
        </section>
      </div>
    </>}
    <Overlay open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter products" variant="drawer">{filterContent}</Overlay>
  </div></main>;
}
