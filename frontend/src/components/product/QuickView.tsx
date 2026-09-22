'use client';

import { useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type { Product } from '@/types';
import { productQueryOptions } from '@/lib/catalog';
import { productName, productHighlights, productHref } from '@/lib/productPresentation';
import { selectVariant } from '@/lib/commerce';
import { formatPrice } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Overlay } from '@/components/common/Overlay';
import { QueryError } from '@/components/common/QueryError';
import { ProductImage } from './ProductImage';
import { VariantSelector } from './VariantSelector';
import { AddToCartButton } from './AddToCartButton';

export function QuickView({ product: preview, onClose, returnFocus }: { product: Product; onClose: () => void; returnFocus: RefObject<HTMLElement | null> }) {
  const [sku, setSku] = useState(preview.catalog?.variantSku);
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const query = useQuery(productQueryOptions(preview.slug));
  const product = query.data ?? preview;
  const variant = selectVariant(product.variants, sku);
  return <Overlay open onClose={onClose} returnFocus={returnFocus} title="A closer look" description={productName(product)} className="max-w-4xl">
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="product-stage relative aspect-square self-start overflow-hidden rounded-xl"><ProductImage src={variant?.images?.[0] || product.images[0]} alt={productName(product)} sizes="(max-width: 639px) 85vw, 380px" className="p-5" /></div>
      <div className="min-w-0 space-y-5">
        <div><p className="eyebrow">{product.brand || product.category?.name}</p><h2 className="mt-2 text-2xl">{productName(product)}</h2><p className="mt-4 font-mono text-2xl">{variant ? formatPrice(variant.price) : 'Unavailable'}</p>{product.isDemo && <p className="mt-2 text-xs text-[var(--accent-violet)]">Sample product · illustrative price · not for sale</p>}</div>
        <dl className="space-y-2">{productHighlights(product).map(([key, value]) => <div key={key} className="flex justify-between gap-4 text-sm"><dt className="text-muted">{key}</dt><dd className="text-right">{value}</dd></div>)}</dl>
        {query.isError ? <QueryError label="Full product information" onRetry={() => void query.refetch()} /> : <p className="line-clamp-4 text-sm leading-relaxed text-secondary">{product.description}</p>}
        {query.isPending && <p role="status" className="flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" aria-hidden />Loading full product details…</p>}
        {product.variants.length > 1 && <VariantSelector variants={product.variants} selectedSku={variant?.sku ?? ''} onSelect={setSku} sample={product.isDemo} />}
        {!admin && !product.isDemo && <AddToCartButton product={product} variant={variant} className="w-full" />}
        <Link href={productHref({ ...product, catalog: variant ? { price: variant.price, maxPrice: variant.price, variantSku: variant.sku, inStock: variant.stock > 0 } : undefined })} onClick={onClose} className="btn-secondary w-full">All product details <ArrowUpRight size={17} aria-hidden /></Link>
      </div>
    </div>
  </Overlay>;
}
