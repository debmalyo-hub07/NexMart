'use client';

import { ProductVariant } from '@/types';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedSku: string;
  onSelect: (sku: string) => void;
}

export function VariantSelector({ variants, selectedSku, onSelect }: VariantSelectorProps) {
  // Group by attribute keys
  const attributeKeys = variants.length > 0
    ? Object.keys(variants[0].attributes || {})
    : [];

  if (!attributeKeys.length) return null;

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => {
        const values = [...new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean))];
        const selectedVariant = variants.find((v) => v.sku === selectedSku);
        const selectedValue = selectedVariant?.attributes?.[key];

        return (
          <div key={key}>
            <p className="text-sm font-medium text-white/70 mb-2 capitalize">
              {key}: <span className="text-white">{selectedValue}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const matchingVariant = variants.find(
                  (v) => v.attributes?.[key] === value &&
                    (selectedVariant ? Object.entries(selectedVariant.attributes || {}).every(
                      ([k, v2]) => k === key || v.attributes?.[k] === v2
                    ) : true)
                );
                const inStock = matchingVariant ? matchingVariant.stock > 0 : false;
                const isSelected = value === selectedValue;

                return (
                  <button
                    key={value}
                    onClick={() => matchingVariant && onSelect(matchingVariant.sku)}
                    disabled={!inStock}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
                      isSelected
                        ? 'border-violet-500 bg-violet-500/20 text-white glow-violet'
                        : inStock
                        ? 'border-white/10 text-white/70 hover:border-white/30 hover:text-white glass'
                        : 'border-white/5 text-white/20 cursor-not-allowed line-through'
                    )}
                  >
                    {value}
                    {!inStock && <span className="ml-1 text-xs">(OOS)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
