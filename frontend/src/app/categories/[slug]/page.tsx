import { Suspense } from 'react';
import { CatalogBrowser } from '@/components/product/CatalogBrowser';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Suspense fallback={<main className="store-page page-container" role="status">Loading category…</main>}><CatalogBrowser categorySlug={slug} /></Suspense>;
}
