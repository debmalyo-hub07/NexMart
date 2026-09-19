import { describe, expect, it } from 'vitest';
import { displayVariant, hasPriceRange, productHref, productName } from './productPresentation';
import { selectVariant } from './commerce';
import type { Product } from '@/types';

const product: Product = { _id: 'product', name: 'Demo · Product name', slug: 'product-name', description: '', category: { _id: 'category', name: 'Category', slug: 'category' }, images: [], tags: [], specifications: {}, ratings: { average: 0, count: 0 }, reviews: [], isPublished: true, isFeatured: false, createdAt: '', variants: [
  { sku: 'unavailable', price: 100, stock: 0, images: [], attributes: {} },
  { sku: 'standard', price: 250, stock: 4, images: [], attributes: {} },
  { sku: 'premium & blue', price: 400, stock: 2, images: [], attributes: {} },
] };
describe('consistent product presentation', () => {
  it('uses the same matching variant for cards and their destination URL', () => {
    const filtered = { ...product, catalog: { price: 400, maxPrice: 400, variantSku: 'premium & blue', inStock: true } };
    expect(displayVariant(filtered)?.price).toBe(400);
    expect(productHref(filtered)).toBe('/products/product-name?option=premium%20%26%20blue');
  });
  it('defaults to the cheapest available option without mutating the source', () => {
    expect(selectVariant(product.variants)?.sku).toBe('standard');
    expect(product.variants[0].sku).toBe('unavailable');
  });
  it('only removes the demo name prefix from explicitly marked samples', () => {
    expect(productName(product)).toBe('Demo · Product name');
    expect(productName({ ...product, isDemo: true })).toBe('Product name');
  });
  it('keeps availability tied to the displayed option', () => {
    const filtered = { ...product, catalog: { price: 100, maxPrice: 100, variantSku: 'unavailable', inStock: false } };
    expect(displayVariant(filtered)?.stock).toBe(0);
  });
  it('shows a from price only when matching options have different prices', () => {
    expect(hasPriceRange({ ...product, catalog: { price: 250, maxPrice: 400, variantSku: 'standard', inStock: true } })).toBe(true);
    expect(hasPriceRange({ ...product, catalog: { price: 400, maxPrice: 400, variantSku: 'premium & blue', inStock: true } })).toBe(false);
  });
  it('does not claim a range for identically priced options', () => {
    expect(hasPriceRange({ ...product, variants: product.variants.map(variant => ({ ...variant, price: 250 })) })).toBe(false);
  });
  it('uses available options when no catalog price summary is present', () => {
    expect(hasPriceRange(product)).toBe(true);
    expect(hasPriceRange({ ...product, variants: product.variants.slice(0, 2) })).toBe(false);
  });
});
