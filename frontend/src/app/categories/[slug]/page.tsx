'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useParams } from 'next/navigation';
import { Product } from '@/types';
import { motion } from 'framer-motion';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'variants.0.price', label: 'Price: Low to High' },
  { value: '-variants.0.price', label: 'Price: High to Low' },
  { value: '-ratings.average', label: 'Top Rated' },
];

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);

  const { data: catData } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => api.get(`/categories/${slug}`).then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['category-products', slug, sort, page, priceRange],
    queryFn: () =>
      api.get(`/products?category=${catData?._id}&sort=${sort}&page=${page}&limit=16&minPrice=${priceRange[0]}&maxPrice=${priceRange[1]}`).then((r) => r.data),
    enabled: !!catData?._id,
  });

  const products: Product[] = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;
  const total = data?.meta?.total || 0;

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        {/* Category hero */}
        <div className="relative border-b border-white/5 bg-gradient-to-br from-space-800 to-space-900 py-14">
          <div className="absolute inset-0 opacity-20"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.4) 0%, transparent 70%)' }} />
          <div className="page-container relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm text-violet-400 mb-2">Category</p>
              <h1 className="font-syne text-4xl font-bold text-white mb-3">{catData?.name || 'Loading...'}</h1>
              {catData?.description && <p className="text-white/50 max-w-xl">{catData.description}</p>}
              <p className="text-sm text-white/30 mt-4">{total} products</p>
            </motion.div>
          </div>
        </div>

        <div className="page-container py-10">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar filters */}
            <aside className="lg:col-span-1">
              <div className="glass rounded-2xl p-5 border border-white/5 sticky top-24">
                <h3 className="font-syne font-semibold text-white mb-5 flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-violet-400" /> Filters
                </h3>

                <div className="mb-6">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Price Range</p>
                  <div className="space-y-2">
                    {[[0, 1000], [1000, 5000], [5000, 20000], [20000, 100000]].map(([min, max]) => (
                      <button key={`${min}-${max}`}
                        suppressHydrationWarning
                        onClick={() => { setPriceRange([min, max]); setPage(1); }}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                          priceRange[0] === min && priceRange[1] === max
                            ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}>
                        {formatPrice(min)} — {max === 100000 ? 'Above' : formatPrice(max)}
                      </button>
                    ))}
                    <button suppressHydrationWarning onClick={() => { setPriceRange([0, 100000]); setPage(1); }}
                      className="text-xs text-white/30 hover:text-white transition-colors mt-1">
                      Clear filter
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* Products grid */}
            <div className="lg:col-span-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-white/40">{total} results</p>
                <div className="relative">
                  <select suppressHydrationWarning value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
                    className="input text-sm py-2 pr-8 appearance-none cursor-pointer">
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {Array(9).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-24">
                  <p className="text-5xl mb-4">📦</p>
                  <h3 className="font-syne text-xl font-bold text-white mb-2">No products found</h3>
                  <p className="text-white/40">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {products.map((p, i) => (
                    <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <ProductCard product={p} />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} suppressHydrationWarning onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-violet-600 text-white shadow-glow-violet' : 'glass text-white/50 hover:text-white'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>    </div>
  );
}
