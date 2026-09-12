'use client';

import { useId } from 'react';
import type { ProductVariant } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { variantLabel } from '@/lib/commerce';

export function VariantSelector({ variants, selectedSku, onSelect }: { variants: ProductVariant[]; selectedSku: string; onSelect: (sku: string) => void }) {
  const id = useId();
  if (!variants.length) return null;
  return <fieldset><legend className="field-label">{variants.length > 1 ? 'Choose an option' : 'Product option'}</legend><div className="grid gap-2 sm:grid-cols-2">
    {variants.map(variant => <label key={variant.sku} className={cn('relative flex min-h-12 cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-300', selectedSku === variant.sku ? 'border-violet-300 bg-violet-500/10' : 'border-white/30')}>
      <input type="radio" name={id} value={variant.sku} checked={selectedSku === variant.sku} onChange={() => onSelect(variant.sku)} className="sr-only" />
      <span className="break-words font-medium">{variantLabel(variant)}</span><span className="text-xs text-secondary"><span className="font-mono">{formatPrice(variant.price)}</span> · {variant.stock > 0 ? 'In stock' : 'Out of stock'}</span>
    </label>)}
  </div></fieldset>;
}
