'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { categoryQueryOptions, parentId, rootCategories } from '@/lib/catalog';
import { CategoryIcon } from '@/components/product/CategoryIcon';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/SkeletonLoader';

export default function CategoriesPage() {
  const query = useQuery(categoryQueryOptions);
  const categories = rootCategories(query.data ?? []);
  return <main id="main-content" className="store-page page-container">
    <PageHeader title="Shop by category" description="Explore the catalog by what you need." eyebrow="Find your direction" />
    {query.isError ? <QueryError label="Categories" onRetry={() => void query.refetch()} /> : query.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div> : !categories.length ? <EmptyState title="No categories yet" description="Browse all available products while the catalog is being organized." action={<Link href="/products" className="btn-primary">All products</Link>} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map(category => <section key={category._id} className="card">
        <Link href={`/categories/${category.slug}`} className="flex min-h-12 items-center gap-3 text-violet-200"><CategoryIcon name={category.name} /><h2 className="flex-1 text-xl text-white">{category.name}</h2><ArrowUpRight size={18} aria-hidden /></Link>
        {category.description && <p className="mt-2 text-sm text-muted">{category.description}</p>}
        <ul className="mt-3 border-t border-white/10 pt-2">{(query.data ?? []).filter(child => parentId(child) === category._id && child.isActive !== false).map(child => <li key={child._id}><Link href={`/categories/${child.slug}`} className="flex min-h-11 items-center text-sm text-secondary hover:text-white">{child.name}</Link></li>)}</ul>
      </section>)}
    </div>}
  </main>;
}
