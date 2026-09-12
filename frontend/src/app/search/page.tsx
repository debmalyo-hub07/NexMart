import { Suspense } from 'react';
import { CatalogBrowser } from '@/components/product/CatalogBrowser';

export const metadata = { title: 'Search' };
export default function SearchPage() {
  return <Suspense fallback={<main className="store-page page-container" role="status">Loading search…</main>}><CatalogBrowser mode="search" /></Suspense>;
}
