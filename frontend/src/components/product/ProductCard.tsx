'use client';

import { memo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowUpRight, Check, Eye, Heart, Star } from 'lucide-react';
import type { Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { displayVariant, hasPriceRange, productHighlights, productHref, productName } from '@/lib/productPresentation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useCompareStore } from '@/store/compareStore';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductImage } from './ProductImage';
import { AddToCartButton } from './AddToCartButton';

const QuickView = dynamic(() => import('./QuickView').then(module => module.QuickView), { ssr: false });

export const ProductCard = memo(function ProductCard({ product, className }: { product: Product; className?: string }) {
  const [preview, setPreview] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const { isWishlisted, toggleWishlist, isLoading: wishlistLoading } = useWishlist();
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const compared = useCompareStore(state => state.products.some(item => item._id === product._id));
  const toggleCompare = useCompareStore(state => state.toggle);
  const toast = useUIStore(state => state.showToast);
  const variant = displayVariant(product);
  const hasOptions = product.variants?.length > 1;
  const inStock = !product.isDemo && (variant?.stock ?? 0) > 0;
  const discount = !product.isDemo && variant?.comparePrice && variant.comparePrice > variant.price ? Math.round((1 - variant.price / variant.comparePrice) * 100) : 0;
  const href = productHref(product);
  const saved = isWishlisted(product._id);
  const name = productName(product);
  const highlights = productHighlights(product, 2);

  return <article className={cn('product-tile group', className)}>
    <div className="relative">
      <Link href={href} className="product-stage relative block aspect-square overflow-hidden" aria-label={`View ${name}`}><ProductImage src={variant?.images?.[0] || product.images?.[0]} alt={name} sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, 320px" className="p-4 transition-transform duration-300 group-hover:scale-[1.035] sm:p-6" /></Link>
      {product.isDemo ? <span className="product-label">Sample</span> : discount > 0 ? <span className="product-label product-label-deal">{discount}% off</span> : product.isFeatured && <span className="product-label">Curated pick</span>}
      {!admin && <button type="button" disabled={wishlistLoading} aria-label={`${saved ? 'Remove' : 'Save'} ${name}${saved ? ' from saved products' : ''}`} aria-pressed={saved} onClick={() => toggleWishlist(product._id)} className="product-save"><Heart size={18} className={saved ? 'fill-current text-red-500' : ''} aria-hidden /></button>}
      <button ref={previewTrigger} type="button" onClick={() => setPreview(true)} className="quick-look" aria-label={`Quick look at ${name}`}><Eye size={16} aria-hidden /><span>Quick look</span></button>
    </div>
    <div className="product-card-content">
      <p className="product-card-brand truncate">{product.brand || product.category?.name || 'NexMart'}</p>
      <h3><Link href={href} className="line-clamp-2 hover:text-[var(--accent-violet)]">{name}</Link></h3>
      <p className="product-card-details line-clamp-2">{highlights.length ? highlights.map(([, value]) => value).join(' · ') : product.description}</p>
      {product.ratings?.count > 0 && <div className="mt-2 flex items-center gap-1.5 text-xs"><span className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 font-medium text-white" aria-label={`Rated ${product.ratings.average.toFixed(1)} out of 5`}><Star size={10} className="fill-current" aria-hidden />{product.ratings.average.toFixed(1)}</span><span className="text-muted">({product.ratings.count})</span></div>}
      <div className="product-card-price">{variant ? <span>{hasPriceRange(product) && <small className="mr-1 text-xs font-normal text-muted">From</small>}{formatPrice(variant.price)}</span> : <span>Unavailable</span>}{discount > 0 && <del><span className="sr-only">MRP </span>{formatPrice(variant!.comparePrice!)}</del>}</div>
      <p className="product-card-stock">{product.isDemo ? 'Sample · not for sale' : inStock ? <><Check size={13} className="text-emerald-700" aria-hidden />{hasOptions ? `${product.variants.length} options · Taxes included` : 'Taxes included'}</> : 'Currently out of stock'}</p>
      <div className="product-card-actions">
        <label className="product-card-compare cursor-pointer"><input type="checkbox" checked={compared} onChange={() => { if (!toggleCompare(product)) toast('Compare up to 3 products. Remove one to add another.', 'info'); }} aria-label={`Compare ${name}`} />{compared ? 'Comparing' : 'Compare'}</label>
        {admin || product.isDemo || hasOptions ? <Link href={href} className="btn-secondary">{hasOptions && !product.isDemo ? 'Choose options' : 'View details'}<ArrowUpRight size={14} aria-hidden /></Link> : <AddToCartButton product={product} variant={variant} />}
      </div>
    </div>
    {preview && <QuickView product={product} onClose={() => setPreview(false)} returnFocus={previewTrigger} />}
  </article>;
});
