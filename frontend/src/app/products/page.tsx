import { Suspense } from 'react';
import { CatalogSnapshot, type CatalogSearchParams } from '@/components/product/CatalogSnapshot';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';

export const metadata = { title: 'Explore the collection', description: 'Find products by category, brand, price, and availability. Compare useful details and explore the NexMart collection.' };
export default function ProductsPage({ searchParams }: { searchParams: CatalogSearchParams }) {
  return <Suspense fallback={<main id="main-content" className="store-page page-container"><div className="product-grid">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div></main>}><CatalogSnapshot searchParams={searchParams} /></Suspense>;
}
