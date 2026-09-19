import { Suspense } from 'react';
import { CatalogSnapshot, type CatalogSearchParams } from '@/components/product/CatalogSnapshot';

export const metadata = { title: 'Explore a category' };
export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: CatalogSearchParams }) {
  const { slug } = await params;
  return <Suspense fallback={<main id="main-content" className="store-page page-container" role="status">Loading category…</main>}><CatalogSnapshot categorySlug={slug} searchParams={searchParams} /></Suspense>;
}
