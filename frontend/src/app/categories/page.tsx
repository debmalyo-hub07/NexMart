'use client';

import Link from 'next/link';
import { Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent?: unknown;
}

export default function CategoriesPage() {
  const query = useQuery<{ data?: Category[] }>({
    queryKey: ['storefront', 'categories', 'all'],
    queryFn: () => api.get('/categories').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });
  const categories = (query.data?.data ?? []).filter((category) => !category.parent);

  return (
    <main className="min-h-[100svh] bg-space-900 pt-[var(--navbar-height)]">
      <section className="border-b border-white/10 bg-space-800/50">
        <div className="page-container py-10 sm:py-14">
          <p className="text-meta font-semibold uppercase tracking-[0.18em] text-violet-400">Browse the catalog</p>
          <h1 className="mt-2 font-outfit text-4xl font-bold text-white sm:text-5xl">Categories</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/65">Choose a direction and compare products without the clutter.</p>
        </div>
      </section>
      <section className="page-container py-10 sm:py-14">
        {query.isError ? (
          <QueryError label="Categories" onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading categories">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-36 rounded-xl border border-white/10 bg-white/[0.04] skeleton" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="py-20 text-center text-sm text-white/60">No categories are available yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <Link key={category._id} href={`/categories/${category.slug}`} className="group flex min-h-36 flex-col justify-between rounded-xl border border-white/10 bg-space-800/70 p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                <span className="text-3xl" aria-hidden>{category.icon || <Tag size={28} className="text-violet-400" />}</span>
                <span>
                  <span className="block font-outfit text-lg font-semibold text-white">{category.name}</span>
                  {category.description && <span className="mt-1 block line-clamp-2 text-sm text-white/55">{category.description}</span>}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
