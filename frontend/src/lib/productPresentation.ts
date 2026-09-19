import type { Product } from '@/types';
import { selectVariant } from './commerce';

export function productName(product: Product) {
  return product.isDemo ? product.name.replace(/^Demo · /, '') : product.name;
}

export function displayVariant(product: Product) {
  return selectVariant(product.variants, product.catalog?.variantSku);
}

/** A filtered single-price option is an exact price, not a "from" promise. */
export function hasPriceRange(product: Product) {
  if (product.catalog) return product.catalog.maxPrice > product.catalog.price;
  const available = product.variants.filter(variant => variant.stock > 0);
  const prices = (available.length ? available : product.variants).map(variant => variant.price);
  return prices.length > 1 && Math.max(...prices) > Math.min(...prices);
}

const keySpecs = ['Storage', 'RAM', 'Processor', 'Display', 'Capacity', 'Material', 'Fit', 'Pattern', 'Author', 'Format', 'Colour', 'Color', 'Product type'];
export function productHighlights(product: Product, limit = 3) {
  const entries = Object.entries(product.specifications ?? {}).filter(([key]) => !['Brand', 'Collection', 'ISBN'].includes(key));
  return entries.sort(([a], [b]) => (keySpecs.includes(a) ? keySpecs.indexOf(a) : 99) - (keySpecs.includes(b) ? keySpecs.indexOf(b) : 99)).slice(0, limit);
}

export function productHref(product: Product) {
  return `/products/${product.slug}${product.catalog?.variantSku ? `?option=${encodeURIComponent(product.catalog.variantSku)}` : ''}`;
}
