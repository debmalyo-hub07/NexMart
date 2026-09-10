'use client';

import { Suspense, useState, useEffect } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { Pagination } from '@/components/common/Pagination';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { Product } from '@/types';
import { Search, X, ChevronDown } from 'lucide-react';
import { QueryError } from '@/components/common/QueryError';

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'variants.0.price', label: 'Price: Low → High' },
  { value: '-variants.0.price', label: 'Price: High → Low' },
  { value: '-ratings.average', label: 'Top Rated' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';

  const [q, setQ] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [inStock, setInStock] = useState(false);

  // Sync URL param → state
  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    setQ(qParam);
    setInputVal(qParam);
    setPage(1);
  }, [searchParams]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['search', q, sort, page, inStock],
    queryFn: () =>
      api.get(`/search?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}&limit=16${inStock ? '&inStock=true' : ''}`).then((r) => r.data),
    enabled: q.length >= 1,
  });

  const products: Product[] = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', inputVal);
    router.push(`/search?${params.toString()}`);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        {/* Search header */}
        <div className="border-b border-white/5 bg-space-800/40 py-10">
          <div className="page-container">
            <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <label htmlFor="search-page-input" className="sr-only">Search products, brands, and categories</label>
                <input
                  id="search-page-input"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Search products, brands, categories…"
                  className="input pl-11 py-3.5 text-base"
                  autoComplete="off"
                />
                {inputVal && (
                  <button type="button" onClick={() => { setInputVal(''); setQ(''); }}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-white/40 hover:text-white transition-colors">
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              <button type="submit" className="btn-primary min-h-12 px-6">Search</button>
            </form>
            {q && (
              <p className="text-center text-sm text-white/40 mt-4">
                {isLoading || isFetching ? 'Searching…' : `${total} results for "${q}"`}
              </p>
            )}
          </div>
        </div>

        <div className="page-container py-10">
          {/* Toolbar */}
          {q && (
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <label className="flex min-h-11 items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={inStock} onChange={(event) => { setInStock(event.target.checked); setPage(1); }} className="h-5 w-5 accent-violet-500" />
                <span className="text-sm text-white/60">In Stock Only</span>
              </label>

              <div className="ml-auto relative">
                <label htmlFor="search-sort" className="sr-only">Sort search results</label>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
                  id="search-sort"
                  className="input text-sm py-2 pr-8 appearance-none cursor-pointer">
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Results */}
          {!q ? (
            <div className="text-center py-32">
              <Search size={48} className="text-white/10 mx-auto mb-4" />
              <p className="font-syne text-xl text-white/30">Start typing to search</p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array(8).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <QueryError label="Search" onRetry={() => void refetch()} />
          ) : products.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🔍</p>
              <h3 className="font-syne text-xl font-bold text-white mb-2">No results for "{q}"</h3>
              <p className="text-white/40">Try different keywords or check the spelling</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      </div>    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-space-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
