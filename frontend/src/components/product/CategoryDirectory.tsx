'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { categoryQueryOptions, parentId, rootCategories } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';
import type { Category } from '@/types';
import { ProductImage } from './ProductImage';
import { CategoryIcon } from './CategoryIcon';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/SkeletonLoader';

export function CategoryDirectory({ initialCategories }: { initialCategories?: Category[] }) {
  const query = useQuery({ ...categoryQueryOptions, initialData: initialCategories });
  const [search, setSearch] = useState('');
  const all = query.data ?? [];
  const needle = search.trim().toLocaleLowerCase();
  const roots = rootCategories(all);
  const childrenOf = (id: string) => all.filter(child => parentId(child) === id && child.isActive !== false);
  const visible = roots.filter(category => [category, ...childrenOf(category._id)].some(item => `${item.name} ${item.description || ''}`.toLocaleLowerCase().includes(needle)));
  return <main id="main-content" className="store-page"><div className="page-container">
    <header className="mb-9 grid items-end gap-6 border-b border-[var(--border)] pb-8 lg:grid-cols-[1fr_380px]">
      <div><p className="eyebrow mb-3 text-[var(--accent-violet)]">Follow your curiosity</p><h1 className="text-4xl font-medium sm:text-5xl">A place for every interest.</h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-secondary">Everyday essentials, considered upgrades, and a few new possibilities. Start with what you love.</p></div>
      <div><label htmlFor="department-search" className="field-label">Find a department</label><div className="relative"><Search size={18} aria-hidden className="absolute left-3.5 top-3.5 text-muted" /><input id="department-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try phones, kitchen, or books" className="input pl-11" /></div></div>
    </header>
    {query.isError ? <QueryError label="Categories" onRetry={() => void query.refetch()} /> : query.isPending ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}</div> : !roots.length ? <EmptyState title="The collection is taking shape" description="Browse the available products while we organise the departments." action={<Link href="/products" className="btn-primary">All products</Link>} /> : !visible.length ? <EmptyState title="No matching department" description="Try a broader term, or search for a specific product." action={<><button className="btn-secondary" type="button" onClick={() => setSearch('')}>Show all departments</button><Link className="btn-primary" href={`/search?q=${encodeURIComponent(search)}`}>Search products</Link></>} /> : <>
      <p role="status" className="mb-5 text-xs text-muted">{visible.length} {visible.length === 1 ? 'department' : 'departments'} to explore</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((category, index) => <article key={category._id} className="category-directory-card flex flex-col">
        <Link href={`/categories/${category.slug}`} className="group relative flex min-h-52 items-center overflow-hidden bg-[var(--product-stage)] p-6" aria-label={`Explore ${category.name}`}>
          <div className="relative z-10 w-1/2"><span className="font-mono text-xs text-muted">{String(roots.indexOf(category) + 1).padStart(2, '0')} /</span><h2 className="mt-5 text-2xl">{category.name}</h2>{category.productCount !== undefined && <p className="mt-2 text-xs text-secondary">{category.productCount} {category.productCount === 1 ? 'find' : 'finds'}</p>}<span className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-control)] transition-colors group-hover:bg-[rgba(23,25,32,0.06)]"><ArrowUpRight size={20} aria-hidden /></span></div>
          <div className="product-stage absolute -right-8 top-1/2 aspect-square w-[58%] -translate-y-1/2 overflow-hidden rounded-full">{category.image ? <ProductImage src={category.image} alt="" sizes="240px" priority={index < 2} className="p-5" /> : <span className="flex h-full items-center justify-center text-space-600"><CategoryIcon name={category.name} size={50} /></span>}</div>
        </Link>
        <div className="flex flex-1 flex-col p-6"><p className="mb-4 text-sm leading-relaxed text-secondary">{category.description || `Explore the ${category.name.toLowerCase()} collection and compare your options.`}</p><nav aria-label={`${category.name} subcategories`} className="mb-4 flex flex-wrap gap-x-4 gap-y-1">{childrenOf(category._id).map(child => <Link key={child._id} href={`/categories/${child.slug}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-violet)]">{child.name}<ArrowUpRight size={12} aria-hidden /></Link>)}</nav><div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-muted">{category.fromPrice !== undefined ? <span>Catalog prices from <span className="font-mono text-secondary">{formatPrice(category.fromPrice)}</span></span> : <span>Explore the collection</span>}<Link href={`/categories/${category.slug}`} className="icon-button" aria-label={`All ${category.name}`}><ArrowRight size={18} aria-hidden /></Link></div></div>
      </article>)}</div>
      <p className="mt-7 text-xs text-muted">Catalog counts include clearly marked sample products. Sample prices are illustrative; use the availability filter to find products you can buy.</p>
    </>}
  </div></main>;
}
