import { Suspense } from 'react';
import { CatalogSnapshot, type CatalogSearchParams } from '@/components/product/CatalogSnapshot';

export const metadata = { title: 'Search the collection' };
export default function SearchPage({ searchParams }: { searchParams: CatalogSearchParams }) {
  return <Suspense fallback={<main id="main-content" className="store-page page-container" role="status">Loading search…</main>}><CatalogSnapshot mode="search" searchParams={searchParams} /></Suspense>;
}
