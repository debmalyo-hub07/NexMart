// Products page loading skeleton — shown instantly during route transition
// Prevents blank screen between navigation and data load
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';

export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-space-900">
      {/* Navbar placeholder */}
      <div className="fixed top-0 left-0 right-0 h-[72px] z-50 glass border-b border-white/5" />

      <div className="pt-[72px]">
        {/* Header skeleton */}
        <div className="border-b border-white/5 bg-space-800/50">
          <div className="page-container py-8">
            <div className="h-8 w-40 rounded-xl skeleton mb-2" />
            <div className="h-4 w-28 rounded-lg skeleton" />
          </div>
        </div>

        <div className="page-container py-8">
          {/* Toolbar skeleton */}
          <div className="flex gap-3 mb-6">
            <div className="h-10 flex-1 max-w-xs rounded-xl skeleton" />
            <div className="h-10 w-36 rounded-xl skeleton" />
            <div className="h-10 w-24 rounded-xl skeleton" />
          </div>

          {/* Product grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array(12).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
