'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Heart, Loader2, Minus, Plus, Share2, ShoppingCart, Star } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { selectVariant } from '@/lib/commerce';
import type { ApiResponse, Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductGallery } from '@/components/product/ProductGallery';
import { VariantSelector } from '@/components/product/VariantSelector';
import { ProductCard } from '@/components/product/ProductCard';
import { ReviewSection } from '@/components/product/ReviewSection';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/SkeletonLoader';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const pending = useRef(false);
  const [adding, setAdding] = useState(false);
  const addItem = useCartStore(s => s.addItem);
  const cartBusy = useCartStore(s => s.isLoading);
  const admin = useAuthStore(s => s.user?.role === 'admin');
  const toast = useUIStore(s => s.showToast);
  const wishlist = useWishlist();
  const query = useQuery({ queryKey: ['storefront', 'product', slug], queryFn: ({ signal }) => api.get<ApiResponse<Product>>(`/products/${encodeURIComponent(slug)}`, { signal }).then(r => r.data.data) });
  const product = query.data;
  const variant = selectVariant(product?.variants, selectedSku);
  const qty = Math.min(quantity, Math.max(1, Math.min(10, variant?.stock ?? 0)));
  const discount = variant?.comparePrice && variant.comparePrice > variant.price ? Math.round((1 - variant.price / variant.comparePrice) * 100) : 0;
  const related = useQuery({ queryKey: ['storefront', 'related', product?.category?._id], queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products', { params: { category: product?.category?._id, limit: 5 }, signal }).then(r => r.data.data ?? []), enabled: !!product?.category?._id });
  async function add() {
    if (!product || !variant || pending.current || variant.stock < qty) return;
    pending.current = true; setAdding(true);
    try { await addItem(product._id, variant.sku, qty); toast('Added to your cart'); }
    catch (error) { toast(getApiError(error), 'error'); }
    finally { pending.current = false; setAdding(false); }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: product?.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast('Product link copied'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast('The link could not be copied. You can copy the address from your browser.', 'info'); }
  }
  return <main id="main-content" className="store-page"><div className="page-container">
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-3 text-sm text-secondary"><Link href="/products" className="inline-flex min-h-11 items-center underline">Products</Link>{product?.category && <><span aria-hidden>/</span><Link className="inline-flex min-h-11 items-center underline" href={`/categories/${product.category.slug}`}>{product.category.name}</Link></>}</nav>
    {query.isPending ? <div className="grid gap-7 lg:grid-cols-2"><Skeleton className="aspect-square rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>
      : query.isError ? <QueryError label="Product details" onRetry={() => void query.refetch()} />
      : !product ? <EmptyState title="Product unavailable" description="This product is no longer in the catalog." action={<Link href="/products" className="btn-primary">Browse products</Link>} />
      : <>
        <div className="grid gap-7 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start"><ProductGallery images={variant?.images?.length ? variant.images : product.images ?? []} name={product.name} /></div>
          <div className="min-w-0 space-y-6">
            <div>{product.brand && <p className="eyebrow mb-2 text-violet-200">{product.brand}</p>}<h1 className="text-2xl leading-tight sm:text-3xl">{product.name}</h1><a href="#product-reviews" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-secondary"><Star size={17} className="text-amber-400" aria-hidden />{product.ratings?.count ? `${product.ratings.average.toFixed(1)} out of 5 · ${product.ratings.count} reviews` : 'No reviews yet'}</a></div>
            <div className="border-y border-white/10 py-5"><div className="flex flex-wrap items-baseline gap-3">{variant ? <p className="break-words font-mono text-3xl font-semibold">{formatPrice(variant.price)}</p> : <p className="text-secondary">Currently unavailable</p>}{discount > 0 && <><del className="text-sm text-muted"><span className="sr-only">MRP </span>{formatPrice(variant!.comparePrice!)}</del><span className="badge-acid">{discount}% off</span></>}</div><p className="mt-2 text-sm text-secondary">GST and shipping are shown in your cart before you order.</p></div>
            <VariantSelector variants={product.variants ?? []} selectedSku={variant?.sku ?? ''} onSelect={sku => { setSelectedSku(sku); setQuantity(1); }} />
            <p className="text-sm text-secondary" role="status">{variant && variant.stock > 0 ? `${variant.stock < 5 ? `${variant.stock} available` : 'In stock'} for the selected option.` : 'This option is currently out of stock.'}</p>
            {admin ? <Link className="btn-secondary" href={`/admin/products/${product._id}/edit`}>Edit this product</Link> : <>
              <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-secondary" id="product-quantity">Quantity</span>{variant && variant?.stock > 0 && <div className="flex items-center rounded-xl border border-white/30" role="group" aria-labelledby="product-quantity"><button type="button" className="icon-button" aria-label="Decrease quantity" disabled={qty <= 1 || adding} onClick={() => setQuantity(qty - 1)}><Minus size={17} aria-hidden /></button><span className="min-w-8 text-center font-mono" aria-live="polite">{qty}</span><button type="button" className="icon-button" aria-label="Increase quantity" disabled={qty >= Math.min(10, variant?.stock ?? 0) || adding} onClick={() => setQuantity(qty + 1)}><Plus size={17} aria-hidden /></button></div>}</div>
              <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void add()} disabled={adding || cartBusy || !variant?.stock} className="btn-primary min-w-0 flex-1">{adding ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <ShoppingCart size={18} aria-hidden />}{adding ? 'Adding…' : 'Add to cart'}</button><button type="button" className="icon-button border border-white/30" aria-label={wishlist.isWishlisted(product._id) ? 'Remove from saved products' : 'Save product'} aria-pressed={wishlist.isWishlisted(product._id)} disabled={wishlist.isLoading} onClick={() => wishlist.toggleWishlist(product._id)}><Heart size={20} className={wishlist.isWishlisted(product._id) ? 'fill-violet-200 text-violet-200' : ''} aria-hidden /></button><button type="button" onClick={() => void share()} className="icon-button border border-white/30" aria-label="Share product"><Share2 size={20} aria-hidden /></button></div>
            </>}
            <div className="rounded-xl border border-white/15 p-4 text-sm text-secondary"><p>Choose online payment or cash on delivery at checkout. Follow payment and fulfillment updates in your orders.</p><Link href="/help" className="mt-2 inline-flex min-h-11 items-center text-violet-200 underline">Shopping and order information</Link></div>
            <section className="field-panel"><h2>About this product</h2><p className="whitespace-pre-line break-words text-sm leading-relaxed text-secondary">{product.description}</p></section>
            {Object.keys(product.specifications ?? {}).length > 0 && <section className="field-panel"><h2>Specifications</h2><dl>{Object.entries(product.specifications).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-white/10 py-3 text-sm"><dt className="break-words text-muted">{key}</dt><dd className="break-words text-secondary">{String(value)}</dd></div>)}</dl></section>}
          </div>
        </div>
        <section id="product-reviews" className="mt-10 scroll-mt-24"><ReviewSection productId={product._id} ratings={product.ratings} /></section>
        {related.isError ? <div className="mt-10"><QueryError label="Related products" onRetry={() => void related.refetch()} /></div> : related.data?.some(item => item._id !== product._id) && <section className="mt-10"><h2 className="section-heading mb-5">In this category</h2><div className="product-grid">{related.data.filter(item => item._id !== product._id).slice(0, 4).map(item => <ProductCard key={item._id} product={item} />)}</div></section>}
      </>}
  </div></main>;
}
