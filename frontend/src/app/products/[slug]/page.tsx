import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProductDetails } from '@/components/product/ProductDetails';
import { publicCatalog } from '@/lib/publicCatalog';
import { productName } from '@/lib/productPresentation';
import type { Product } from '@/types';

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = (await publicCatalog<Product>(`/products/${encodeURIComponent(slug)}`))?.data;
  return { title: product ? productName(product) : 'Product details', description: product?.description?.slice(0, 160), ...(product?.isDemo ? { robots: { index: false, follow: true } } : {}) };
}
async function Detail({ slug }: { slug: string }) {
  const product = await publicCatalog<Product>(`/products/${encodeURIComponent(slug)}`);
  return <ProductDetails slug={slug} initialProduct={product?.data} />;
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <Suspense fallback={<main id="main-content" className="store-page page-container" role="status">Loading product details…</main>}><Detail slug={slug} /></Suspense>;
}
