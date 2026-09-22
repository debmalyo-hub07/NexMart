'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import api from '@/lib/api';
import { catalogParams, CATALOG_SORTS } from '@/lib/catalogFilters';
import { categoryQueryOptions, parentId, rootCategories } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';
import type { ApiResponse, Category, Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { CatalogFilters } from './CatalogFilters';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { Overlay } from '@/components/common/Overlay';
import { Select } from '@/components/common/Select';

export function CatalogBrowser({ mode = 'products', categorySlug, initialData, initialCategories, initialQuery }: { mode?: 'products' | 'search'; categorySlug?: string; initialData?: ApiResponse<Product[]>; initialCategories?: Category[]; initialQuery?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = catalogParams(searchParams, categorySlug);
  const q = params.get('q') || '';
  const page = Number(params.get('page'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useQuery({ ...categoryQueryOptions, initialData: initialCategories });
  const category = categories.data?.find(item => item.slug === categorySlug);
  const children = categories.data?.filter(item => parentId(item) === category?._id) ?? [];
  const needsQuery = mode !== 'search' || !!q;
  const query = useQuery({
    queryKey: ['storefront', 'products', params.toString()],
    queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>(`/products?${params}`, { signal }).then(response => response.data),
    enabled: needsQuery,
    initialData: initialQuery === params.toString() ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  function update(values: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    if (categorySlug) next.delete('category');
    if (resetPage) next.delete('page');
    // Immediate URL-backed queries; direct visits still receive a server snapshot.
    window.history.pushState(null, '', `${pathname}${next.size ? `?${next}` : ''}`);
  }
  function clear() { update({ minPrice: '', maxPrice: '', rating: '', inStock: '', featured: '', category: '', brand: '' }); }
  function removeValue(key: string, value: string) { update({ [key]: (params.get(key) || '').split(',').filter(item => item !== value).join(',') }); }
  const applied: Array<{ key: string; value: string; label: string }> = [];
  if (!categorySlug) for (const value of (params.get('category') || '').split(',').filter(Boolean)) applied.push({ key: 'category', value, label: categories.data?.find(item => item.slug === value || item._id === value)?.name || value });
  for (const value of (params.get('brand') || '').split(',').filter(Boolean)) applied.push({ key: 'brand', value, label: value });
  for (const key of ['minPrice', 'maxPrice', 'rating', 'inStock', 'featured']) {
    const value = params.get(key);
    if (value) applied.push({ key, value, label: key === 'minPrice' ? `Over ${formatPrice(Number(value))}` : key === 'maxPrice' ? `Under ${formatPrice(Number(value))}` : key === 'rating' ? `${value}+ stars` : key === 'inStock' ? 'Available to buy' : 'Curated picks' });
  }
  const total = query.data?.meta?.total ?? 0;
  const title = categorySlug ? category?.name || 'Explore this category' : mode === 'search' ? q ? `Results for “${q}”` : 'What will you discover?' : 'Find your next good thing.';
  const outOfRange = total > 0 && page > (query.data?.meta?.totalPages ?? 1);
  const renderFilters = (instant: boolean) => <>{categories.isError && <QueryError label="Category filters" onRetry={() => void categories.refetch()} />}<CatalogFilters key={params.toString()} params={params} categories={categories.data ?? []} facets={query.data?.facets} categorySlug={categorySlug} instant={instant} apply={values => { update(values); if (!instant) setFiltersOpen(false); }} /></>;
  const sortOptions = [{ value: 'default', label: q ? 'Most relevant' : 'Recommended' }, ...CATALOG_SORTS];

  return <main id="main-content" className="store-page"><div className="page-container">
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs text-muted"><Link href="/" className="inline-flex min-h-11 items-center hover:text-white">Home</Link><ChevronRight size={12} aria-hidden /><Link href={categorySlug ? '/categories' : '/products'} className="inline-flex min-h-11 items-center hover:text-white">{categorySlug ? 'Categories' : 'The collection'}</Link>{category && <><ChevronRight size={12} aria-hidden /><span className="text-secondary">{category.name}</span></>}</nav>
    <header className="mb-8 flex items-center justify-between gap-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:p-8">
      <div className="min-w-0"><p className="eyebrow mb-3 text-[var(--accent-violet)]">{categorySlug ? 'A little more your kind of thing' : mode === 'search' ? 'Discover NexMart' : 'The NexMart collection'}</p><h1 className="text-3xl font-medium leading-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{category?.description || 'Thoughtful finds, useful details, and a little inspiration for your everyday.'}</p></div>
      {category?.image && <div className="product-stage relative hidden h-36 w-36 shrink-0 overflow-hidden rounded-full sm:block"><ProductImage src={category.image} alt="" sizes="144px" className="p-3" /></div>}
    </header>
    {children.length > 0 && <nav aria-label="Subcategories" className="mb-7 flex flex-wrap gap-2">{children.map(child => <Link key={child._id} href={`/categories/${child.slug}`} className="filter-chip hover:border-violet-300">{child.name}<span className="text-muted">{child.productCount ?? ''}</span><ArrowUpRight size={13} aria-hidden /></Link>)}</nav>}
    <form role="search" className="mb-7 flex max-w-2xl gap-2" onSubmit={event => { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get('q') || '').trim() }); }}>
      <label htmlFor="catalog-query" className="sr-only">Search this collection</label><div className="relative min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-muted" aria-hidden /><input key={q} id="catalog-query" name="q" type="search" defaultValue={q} maxLength={200} placeholder={category ? `Search in ${category.name}` : 'Search a product, brand, or something you love…'} className="input pl-10" autoComplete="off" enterKeyHint="search" /></div><button type="submit" className="btn-primary shrink-0 px-5">Search</button>
    </form>
    {categories.isSuccess && categorySlug && !category ? <EmptyState title="This category is unavailable" description="Discover the other departments in our catalog." action={<Link href="/categories" className="btn-primary">Browse categories</Link>} /> : <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border)] py-4">
        <div className="flex items-center gap-4"><button type="button" className="btn-secondary px-3 lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} aria-hidden />Filters{applied.length ? ` (${applied.length})` : ''}</button><p className="text-sm text-secondary" role="status">{!needsQuery ? 'Search by name, brand, or category' : query.isError ? 'Products unavailable' : query.isPending ? 'Finding your next favourites…' : query.isFetching ? `Updating ${total} results…` : <><span className="font-medium text-white">{total}</span> {total === 1 ? 'product' : 'products'} to explore</>}</p></div>
        <div className="flex items-center gap-3"><label htmlFor="catalog-sort" className="hidden text-xs text-muted sm:block">Sort by</label><Select id="catalog-sort" label="Sort products" value={params.get('sort') || 'default'} onChange={value => update({ sort: value === 'default' ? '' : value })} options={sortOptions} /></div>
      </div>
      {applied.length > 0 && <div className="mb-6 flex flex-wrap gap-2" aria-label="Applied filters">{applied.map(filter => <button type="button" key={`${filter.key}-${filter.value}`} className="filter-chip" onClick={() => removeValue(filter.key, filter.value)} aria-label={`Remove ${filter.label} filter`}>{filter.label}<X size={13} aria-hidden /></button>)}<button type="button" className="min-h-11 px-3 text-xs text-secondary underline underline-offset-4" onClick={clear}>Clear all</button></div>}
      <div className="grid gap-7 lg:grid-cols-[244px_minmax(0,1fr)] xl:gap-9">
        <aside aria-label="Catalog filters" className="hidden self-start border-r border-[var(--border)] pr-6 lg:block"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg">Refine your find</h2><SlidersHorizontal size={17} className="text-muted" aria-hidden /></div>{renderFilters(true)}</aside>
        <section className="min-w-0" aria-label="Products" aria-busy={query.isFetching}>
          {query.data?.search?.mode === 'approximate' && <p className="mb-5 rounded-lg border border-violet-300/40 bg-violet-500/10 p-4 text-sm text-secondary">No exact matches for “{q}”. Here are some close matches; your filters still apply.</p>}
          {!needsQuery ? <div><EmptyState title="Find your next favourite" description="Try a product type, a brand, or a detail such as storage or colour." icon={Search} /> <nav aria-label="Explore departments" className="mt-5 flex flex-wrap gap-2">{rootCategories(categories.data ?? []).map(item => <Link key={item._id} href={`/categories/${item.slug}`} className="filter-chip">{item.name}<ArrowUpRight size={14} aria-hidden /></Link>)}</nav></div>
            : query.isError ? <QueryError label="Products" onRetry={() => void query.refetch()} />
            : query.isPending ? <div className="catalog-grid">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
            : outOfRange ? <EmptyState title="That page is no longer available" description="The collection has changed. Return to the first page to see the current selection." action={<button type="button" className="btn-primary" onClick={() => update({ page: '1' }, false)}>Back to results</button>} />
            : !query.data?.data?.length ? <EmptyState title="Let's try a different direction." description="There are no products matching this combination. Remove a filter or try a broader search." action={<><button className="btn-secondary" type="button" onClick={clear}>Clear filters</button>{q && <button type="button" className="btn-secondary" onClick={() => update({ q: '' })}>Clear search</button>}<Link href="/categories" className="btn-primary">Explore categories</Link></>} />
            : <><div className={`catalog-grid transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>{query.data.data.map(product => <ProductCard key={product._id} product={product} />)}</div>{query.data.data.some(product => product.isDemo) && <p className="mt-5 text-xs text-muted">Sample items show illustrative prices and are not available to buy. Use “Available to buy” to see purchasable products.</p>}</>}
          {!query.isError && !outOfRange && (query.data?.meta?.totalPages ?? 0) > 1 && <div className="mt-9 border-t border-[var(--border)] pt-6"><Pagination page={page} totalPages={query.data!.meta!.totalPages} onPageChange={next => { update({ page: String(next) }, false); window.scrollTo({ top: 0 }); }} /></div>}
        </section>
      </div>
    </>}
    <Overlay open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Refine your find" description="Combine categories and brands to find the right option." variant="drawer">{renderFilters(false)}</Overlay>
  </div></main>;
}
