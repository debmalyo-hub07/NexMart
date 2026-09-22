'use client';

import { useId } from 'react';
import type { ProductVariant } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { variantLabel } from '@/lib/commerce';

export function VariantSelector({ variants, selectedSku, onSelect, sample = false }: { variants: ProductVariant[]; selectedSku: string; onSelect: (sku: string) => void; sample?: boolean }) {
  const id = useId();
  if (!variants.length) return null;
  return <fieldset><legend className="field-label">{variants.length > 1 ? 'Choose an option' : 'Product option'}</legend><div className="grid gap-2 sm:grid-cols-2">
    {variants.map(variant => <label key={variant.sku} className={cn('relative flex min-h-12 cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563EB]', selectedSku === variant.sku ? 'border-[var(--accent-violet)] bg-[rgba(18,62,117,0.08)]' : 'border-[var(--border-control)]')}>
      {/* The input covers the whole chip (visually transparent) instead of being
          sr-only: it must be the actual pointer target, otherwise the styled
          label text intercepts clicks and keyboard/AT activation differs from
          mouse activation. Focus styling stays on the label via focus-within. */}
      <input type="radio" name={id} value={variant.sku} checked={selectedSku === variant.sku} onChange={() => onSelect(variant.sku)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0" />
      <span className="break-words font-medium">{variantLabel(variant)}</span><span className="text-xs text-secondary"><span className="font-mono">{formatPrice(variant.price)}</span> · {sample ? 'Sample option' : variant.stock > 0 ? 'In stock' : 'Out of stock'}</span>
    </label>)}
  </div></fieldset>;
}
