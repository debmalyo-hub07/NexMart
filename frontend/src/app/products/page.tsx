'use client';

import { Suspense, useState, useCallback } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { Pagination } from '@/components/common/Pagination';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, Search, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '@/hooks/useDebounce';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { label: 'Newest First', value: '-createdAt' },
  { label: 'Price: Low to High', value: 'variants.0.price' },
  { label: 'Price: High to Low', value: '-variants.0.price' },
  { label: 'Best Rating', value: '-ratings.average' },
];

const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – ₹20,000', min: 5000, max: 20000 },
  { label: 'Above ₹20,000', min: 20000, max: undefined },
];

const filterVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1 },
};

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const debouncedSearch = useDebounce(search, 250); // 250ms — snappy feel

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', debouncedSearch, sort, page, minPrice, maxPrice, minRating],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page), limit: '12', sort,
      });
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (minPrice !== undefined) params.set('minPrice', String(minPrice));
      if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
      if (minRating) params.set('rating', String(minRating));
      const endpoint = debouncedSearch ? `/search?${params}` : `/products?${params}`;
      return api.get(endpoint).then((r) => r.data);
    },
    // Keep previous data while fetching — grid never blanks on filter/sort/page change
    placeholderData: keepPreviousData,
  });

  const products: Product[] = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  const clearFilters = useCallback(() => { setMinPrice(undefined); setMaxPrice(undefined); setMinRating(undefined); setSearch(''); setPage(1); }, []);
  const hasFilters = !!(minPrice || maxPrice || minRating || debouncedSearch);

  const toggleFilter = useCallback(() => setFilterOpen(o => !o), []);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }, []);
  const clearSearch = useCallback(() => { setSearch(''); setPage(1); }, []);
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSort(e.target.value), []);

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        {/* Page Header */}
        <div className="border-b border-white/5 bg-space-800/50">
          <div className="page-container py-8">
            <h1 className="font-syne text-3xl font-bold text-white mb-1">All Products</h1>
            <p className="text-white/50 text-sm">{data?.meta?.total ?? '...'} products found</p>
          </div>
        </div>

        <div className="page-container py-8">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={handleSearchChange}
                placeholder="Search products..." className="input pl-9 py-2 text-sm" suppressHydrationWarning />
              {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70" suppressHydrationWarning><X size={13} /></button>}
            </div>

            {/* Sort */}
            <div className="relative">
              <select value={sort} onChange={handleSortChange}
                className="input py-2 text-sm pr-8 appearance-none cursor-pointer" suppressHydrationWarning>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>

            {/* Filter toggle */}
            <button onClick={toggleFilter}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border',
                filterOpen ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'glass text-white/60 hover:text-white border-white/10')}
              suppressHydrationWarning>
              <SlidersHorizontal size={14} />
              Filters
              {hasFilters && <span className="w-2 h-2 rounded-full bg-acid-400" />}
            </button>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300" suppressHydrationWarning>
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {filterOpen && (
              <motion.div variants={filterVariants} initial="hidden" animate="visible" exit="hidden"
                className="glass rounded-2xl p-5 border border-white/5 mb-6 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Price Range */}
                  <div>
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Price Range</p>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_RANGES.map((r) => (
                        <button key={r.label}
                          onClick={() => { setMinPrice(r.min || undefined); setMaxPrice(r.max); setPage(1); }}
                          className={cn('px-3 py-1.5 rounded-lg text-xs transition-colors border',
                            minPrice === (r.min || undefined) && maxPrice === r.max
                              ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                              : 'border-white/10 text-white/50 hover:text-white hover:border-white/20')}
                          suppressHydrationWarning>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Min Rating</p>
                    <div className="flex gap-2">
                      {[4, 3, 2].map((r) => (
                        <button key={r} onClick={() => { setMinRating(r === minRating ? undefined : r); setPage(1); }}
                          className={cn('px-3 py-1.5 rounded-lg text-xs transition-colors border',
                            minRating === r ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-white/10 text-white/50 hover:text-white')}
                          suppressHydrationWarning>
                          {r}★ & above
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
            {isLoading
              ? Array(12).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((p) => <ProductCard key={p._id} product={p} />)
            }
          </div>

          {products.length === 0 && !isLoading && (
            <div className="text-center py-24">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-syne text-xl font-bold text-white mb-2">No products found</p>
              <p className="text-white/40 text-sm">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-space-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
