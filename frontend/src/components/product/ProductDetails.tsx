'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronRight, GitCompareArrows, Heart, Info, Minus, Plus, RotateCcw, Share2, Star, Truck } from 'lucide-react';
import api from '@/lib/api';
import { productQueryOptions } from '@/lib/catalog';
import { selectVariant, variantLabel } from '@/lib/commerce';
import { productHighlights, productName } from '@/lib/productPresentation';
import { formatPrice } from '@/lib/utils';
import type { ApiResponse, Product } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useCompareStore } from '@/store/compareStore';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductGallery } from './ProductGallery';
import { VariantSelector } from './VariantSelector';
import { ProductCard } from './ProductCard';
import { ReviewSection } from './ReviewSection';
import { SellerOffers } from './SellerOffers';
import { AddToCartButton } from './AddToCartButton';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { ProductCardSkeleton, Skeleton } from '@/components/common/SkeletonLoader';

export function ProductDetails({ slug, initialProduct }: { slug: string; initialProduct?: Product }) {
  const path = usePathname();
  const search = useSearchParams();
  const [quantity, setQuantity] = useState(1);
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const toast = useUIStore(state => state.showToast);
  const wishlist = useWishlist();
  const compared = useCompareStore(state => state.products);
  const toggleCompare = useCompareStore(state => state.toggle);
  const query = useQuery({ ...productQueryOptions(slug), initialData: initialProduct });
  const product = query.data;
  const variant = selectVariant(product?.variants, search.get('option') || '');
  const qty = Math.min(quantity, Math.max(1, Math.min(10, variant?.stock ?? 0)));
  const related = useQuery({ queryKey: ['storefront', 'related', product?.category?._id], queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products', { params: { category: product?.category?._id, limit: 5 }, signal }).then(response => response.data.data ?? []), enabled: !!product?.category?._id, staleTime: 60_000 });
  function choose(sku: string) {
    const next = new URLSearchParams(search); next.set('option', sku);
    // Native history updates Next search params without a server round trip.
    window.history.replaceState(null, '', `${path}?${next}`);
    setQuantity(1);
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: product && productName(product), url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast('Product link copied'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast('Copy the link from your browser to share this product.', 'info'); }
  }
  const name = product ? productName(product) : 'Product details';
  const highlights = product ? productHighlights(product, 4) : [];
  const comparison = product && compared.some(item => item._id === product._id);
  const discount = variant?.comparePrice && variant.comparePrice > variant.price ? Math.round((1 - variant.price / variant.comparePrice) * 100) : 0;
  return <main id="main-content" className="store-page"><div className="page-container">
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted"><Link href="/" className="inline-flex min-h-11 items-center hover:text-white">Home</Link><ChevronRight size={12} aria-hidden /><Link href="/products" className="inline-flex min-h-11 items-center hover:text-white">The collection</Link>{product?.category && <><ChevronRight size={12} aria-hidden /><Link className="inline-flex min-h-11 items-center hover:text-white" href={`/categories/${product.category.slug}`}>{product.category.name}</Link></>}</nav>
    {query.isPending ? <div className="grid gap-8 lg:grid-cols-2"><Skeleton className="aspect-square rounded-2xl" /><div className="space-y-5"><Skeleton className="h-24" /><Skeleton className="h-16" /><Skeleton className="h-44" /></div></div> : query.isError ? <QueryError label="Product details" onRetry={() => void query.refetch()} /> : !product ? <EmptyState title="This product is unavailable" description="Explore the other finds in our collection." action={<Link className="btn-primary" href="/products">Browse products</Link>} /> : <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0 self-start lg:sticky lg:top-[calc(var(--navbar-height)+24px)]"><ProductGallery images={variant?.images?.length ? variant.images : product.images ?? []} name={name} />{product.isDemo && <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted"><Info size={16} className="mt-0.5 shrink-0" aria-hidden />Reference photography for a sample product. Verify commercial image rights and seller details before publishing a real listing.</p>}</div>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">{product.brand && <Link href={`/products?brand=${encodeURIComponent(product.brand)}`} className="eyebrow inline-flex min-h-11 items-center text-violet-200">{product.brand}</Link>}{product.isDemo ? <span className="badge-neutral">Sample collection</span> : product.isFeatured && <span className="badge-violet">In the curated edit</span>}</div>
          <h1 className="text-3xl font-medium leading-tight sm:text-4xl">{name}</h1>
          {!product.isDemo && <a href="#product-reviews" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-secondary"><Star size={16} className="text-amber-400" aria-hidden />{product.ratings?.count ? `${product.ratings.average.toFixed(1)} · ${product.ratings.count} ${product.ratings.count === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</a>}
          <p className="mt-4 text-sm leading-relaxed text-secondary">{product.description}</p>
          {highlights.length > 0 && <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-white/15 bg-space-800 p-4">{highlights.map(([key, value]) => <div key={key}><dt className="text-xs text-muted">{key}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>}
          <div className="my-6 border-y border-white/15 py-5"><div className="flex flex-wrap items-baseline gap-3">{variant ? <p className="font-mono text-3xl font-semibold">{formatPrice(variant.price)}</p> : <p className="text-secondary">Price unavailable</p>}{discount > 0 && !product.isDemo && <><del className="font-mono text-sm text-muted"><span className="sr-only">Previous price </span>{formatPrice(variant!.comparePrice!)}</del><span className="badge-acid">{discount}% off</span></>}</div><p className="mt-2 text-xs text-muted">{product.isDemo ? 'Illustrative INR price · This sample cannot be purchased.' : 'Shipping and tax are itemised in your cart before you order.'}</p></div>
          <VariantSelector variants={product.variants ?? []} selectedSku={variant?.sku ?? ''} onSelect={choose} sample={product.isDemo} />
          {product.isDemo ? <div className="mt-5 rounded-xl border border-white/20 bg-space-700 p-4"><p className="flex items-center gap-2 text-sm font-medium"><Info size={17} aria-hidden />A little inspiration, not live inventory.</p><p className="mt-2 text-xs leading-relaxed text-secondary">This product helps you explore the catalog and compare designs. Availability, seller terms, warranties, and prices must be confirmed before it can be sold.</p><Link href="/products?inStock=true" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-violet-200">Browse products available to buy <ArrowRight size={15} aria-hidden /></Link></div> : <p className={`mt-4 flex items-center gap-2 text-sm ${variant?.stock ? 'text-acid-400' : 'text-secondary'}`} role="status">{variant?.stock ? <Check size={17} aria-hidden /> : <Info size={17} aria-hidden />}{variant?.stock ? variant.stock < 5 ? `${variant.stock} available for this option` : 'In stock for this option' : 'This option is currently unavailable'}</p>}
          <div className="mt-5 space-y-3">{admin ? <Link href={`/admin/products/${product._id}/edit`} className="btn-secondary w-full">Edit this product</Link> : <div className="flex gap-3">{!!variant?.stock && !product.isDemo && <div className="flex items-center rounded-lg border border-white/30" role="group" aria-label="Quantity"><button type="button" className="icon-button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQuantity(qty - 1)}><Minus size={16} aria-hidden /></button><span className="min-w-6 text-center font-mono text-sm" aria-live="polite">{qty}</span><button type="button" className="icon-button" aria-label="Increase quantity" disabled={qty >= Math.min(10, variant.stock)} onClick={() => setQuantity(qty + 1)}><Plus size={16} aria-hidden /></button></div>}<AddToCartButton product={product} variant={variant} quantity={qty} className="min-h-12 flex-1" /></div>}
            <div className="grid grid-cols-3 gap-2"><button type="button" className="btn-secondary gap-1.5 px-2 text-xs" aria-pressed={wishlist.isWishlisted(product._id)} disabled={wishlist.isLoading} onClick={() => wishlist.toggleWishlist(product._id)}><Heart size={16} className={wishlist.isWishlisted(product._id) ? 'fill-current' : ''} aria-hidden />Save</button><button type="button" className="btn-secondary gap-1.5 px-2 text-xs" aria-pressed={!!comparison} onClick={() => { if (!toggleCompare({ ...product, catalog: variant ? { price: variant.price, maxPrice: variant.price, variantSku: variant.sku, inStock: variant.stock > 0 } : undefined })) toast('You can compare up to three products. Remove one to add another.', 'info'); }}><GitCompareArrows size={16} aria-hidden />{comparison ? 'Comparing' : 'Compare'}</button><button type="button" onClick={() => void share()} className="btn-secondary gap-1.5 px-2 text-xs"><Share2 size={16} aria-hidden />Share</button></div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-white/15 pt-5 sm:grid-cols-2"><Link href="/shipping" className="flex items-start gap-3 text-sm"><Truck size={20} className="mt-1 shrink-0 text-muted" aria-hidden /><span>Delivery information<span className="mt-1 block text-xs leading-relaxed text-muted">Check dispatch, shipping, and order tracking.</span></span></Link><Link href="/returns" className="flex items-start gap-3 text-sm"><RotateCcw size={20} className="mt-1 shrink-0 text-muted" aria-hidden /><span>Returns & cancellations<span className="mt-1 block text-xs leading-relaxed text-muted">Understand the terms before ordering.</span></span></Link></div>
          {!product.isDemo && <SellerOffers productId={product._id} currentSku={variant?.sku ?? ''} />}
        </div>
      </div>
      <nav aria-label="Product information" className="mt-10 flex gap-6 overflow-x-auto border-y border-white/15 text-sm"><a href="#product-details" className="inline-flex min-h-14 shrink-0 items-center">The details</a><a href="#product-specifications" className="inline-flex min-h-14 shrink-0 items-center">Specifications</a>{!product.isDemo && <a href="#product-reviews" className="inline-flex min-h-14 shrink-0 items-center">Customer reviews</a>}<a href="#related-products" className="inline-flex min-h-14 shrink-0 items-center">More to explore</a></nav>
      <div className="grid gap-8 py-9 lg:grid-cols-[1fr_1.2fr] lg:gap-16"><section id="product-details" className="policy-content"><p className="eyebrow mb-3">A closer look</p><h2 className="section-heading">Made for your everyday.</h2><p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-secondary">{product.description}</p><p className="mt-4 text-xs text-muted">Selected option: {variant ? variantLabel(variant) : 'None available'}. {product.isDemo ? 'Sample specifications are reference information, not a seller guarantee.' : 'Review the selected option and seller terms before placing an order.'}</p></section><section id="product-specifications" className="policy-content"><h2 className="mb-4 text-xl">All the useful details</h2>{Object.keys(product.specifications ?? {}).length ? <dl className="overflow-hidden rounded-xl border border-white/15">{Object.entries(product.specifications).map(([key, value], index) => <div key={key} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-space-800' : ''}`}><dt className="break-words text-muted">{key}</dt><dd className="break-words text-secondary">{value}</dd></div>)}</dl> : <p className="rounded-xl border border-white/15 p-5 text-sm text-muted">Detailed specifications haven’t been provided for this product yet. Don’t assume a feature that isn’t listed.</p>}</section></div>
      {!product.isDemo && <section id="product-reviews" className="policy-content"><ReviewSection productId={product._id} ratings={product.ratings} /></section>}
      <section id="related-products" className="policy-content mt-10 border-t border-white/15 pt-8"><div className="mb-6 flex items-end justify-between gap-3"><div><p className="eyebrow mb-2">Keep exploring</p><h2 className="section-heading">A few more possibilities.</h2></div>{product.category && <Link href={`/categories/${product.category.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary"><span className="hidden sm:inline">Explore {product.category.name}</span><ArrowRight size={19} aria-hidden /><span className="sr-only sm:hidden">Explore this category</span></Link>}</div>{related.isError ? <QueryError label="Related products" onRetry={() => void related.refetch()} /> : related.isPending ? <div className="product-grid">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div> : !related.data?.some(item => item._id !== product._id) ? <p className="py-6 text-sm text-muted">More products will appear here as this collection grows.</p> : <div className="product-grid">{related.data.filter(item => item._id !== product._id).slice(0, 4).map(item => <ProductCard key={item._id} product={item} />)}</div>}</section>
    </>}
  </div></main>;
}
