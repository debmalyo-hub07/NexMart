import { Suspense } from 'react';
import { CatalogBrowser } from '@/components/product/CatalogBrowser';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';

export const metadata = { title: 'Products' };
export default function ProductsPage() {
  return <Suspense fallback={<main className="store-page page-container"><div className="product-grid">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div></main>}><CatalogBrowser /></Suspense>;
}
