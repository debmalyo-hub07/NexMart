'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, X } from 'lucide-react';
import { useCompareStore } from '@/store/compareStore';
import { displayVariant, productName, productHref } from '@/lib/productPresentation';
import { formatPrice } from '@/lib/utils';
import { Overlay } from '@/components/common/Overlay';
import { ProductImage } from './ProductImage';

export function CompareTray() {
  const { products, remove, clear } = useCompareStore();
  const [open, setOpen] = useState(false);
  if (!products.length) return null;
  const keys = [...new Set(products.flatMap(product => Object.keys(product.specifications ?? {})))].filter(key => !['Collection', 'Brand'].includes(key));
  return <>
    <aside className="compare-tray" aria-label="Product comparison">
      <div className="hidden gap-2 sm:flex">{products.map(product => <div key={product._id} className="relative"><span className="product-stage relative block h-12 w-12 overflow-hidden rounded-lg"><ProductImage src={product.images[0]} alt={productName(product)} sizes="48px" className="p-1" /></span><button type="button" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-control)] bg-[var(--bg-card)]" aria-label={`Remove ${productName(product)} from comparison`} onClick={() => remove(product._id)}><X size={12} aria-hidden /></button></div>)}</div>
      <p className="min-w-0 text-sm"><span className="font-semibold">{products.length} of 3 products</span><span className="hidden text-xs text-muted sm:block">A clearer view, side by side.</span></p>
      <button type="button" className="btn-primary px-3" onClick={() => setOpen(true)} disabled={products.length < 2}><ArrowRightLeft size={16} aria-hidden />Compare</button>
      <button type="button" className="icon-button" onClick={clear} aria-label="Clear comparison"><X size={18} aria-hidden /></button>
    </aside>
    <Overlay open={open} onClose={() => setOpen(false)} title="Find your better fit" description="Compare the selected products and their available information." className="max-w-5xl">
      <div className="overflow-x-auto">
        <table className="compare-table"><caption className="sr-only">Product prices, availability, and specifications</caption><thead><tr><th scope="col">At a glance</th>{products.map(product => <th key={product._id} scope="col"><div className="product-stage relative mx-auto mb-4 h-32 w-32 rounded-lg"><ProductImage src={product.images[0]} alt={productName(product)} sizes="128px" className="p-3" /></div><Link href={productHref(product)} onClick={() => setOpen(false)} className="text-base hover:text-[var(--accent-violet-light)]">{productName(product)}</Link><button type="button" onClick={() => remove(product._id)} className="mt-2 block min-h-11 text-xs font-normal text-muted underline">Remove</button></th>)}</tr></thead><tbody>
          <tr><th scope="row">Price</th>{products.map(product => <td key={product._id} className="font-mono">{displayVariant(product) ? formatPrice(displayVariant(product)!.price) : 'Not listed'}</td>)}</tr>
          <tr><th scope="row">Availability</th>{products.map(product => <td key={product._id}>{product.isDemo ? 'Sample · not for sale' : displayVariant(product)?.stock ? 'In stock' : 'Out of stock'}</td>)}</tr>
          <tr><th scope="row">Brand</th>{products.map(product => <td key={product._id}>{product.brand || 'Not specified'}</td>)}</tr>
          {keys.map(key => <tr key={key}><th scope="row">{key}</th>{products.map(product => <td key={product._id}>{product.specifications?.[key] || 'Not specified'}</td>)}</tr>)}
        </tbody></table>
      </div>
    </Overlay>
  </>;
}
