import type { CartItem, ProductVariant } from '@/types';

export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Mirrors the server's existing > ₹999 shipping rule and 18% GST. */
export function calculateTotals(items: { price: number; quantity: number }[]) {
  const subtotal = items.reduce((sum, item) => sum + Math.round((item.price + Number.EPSILON) * 100) * item.quantity, 0) / 100;
  const shippingFee = items.length === 0 || subtotal > 999 ? 0 : 49;
  const tax = money(subtotal * 0.18);
  return { subtotal, shippingFee, tax, discount: 0, total: money(subtotal + shippingFee + tax) };
}

export function selectVariant(variants: ProductVariant[] = [], sku?: string) {
  const selected = variants.find(variant => variant.sku === sku);
  if (selected) return selected;
  const available = variants.filter(variant => variant.stock > 0);
  return [...(available.length ? available : variants)].sort((a, b) => a.price - b.price)[0];
}

export function variantLabel(variant: ProductVariant) {
  return Object.values(variant.attributes ?? {}).join(' · ') || 'Standard option';
}

export function getCartItemState(item: CartItem) {
  const variant = item.product?.variants?.find(option => option.sku === item.variant);
  const price = item.listing ? item.offer?.price ?? item.price : variant?.price ?? item.price;
  const stock = item.listing ? item.offer?.stock ?? 0 : variant?.stock ?? 0;
  const reason = !item.product || item.product.isPublished === false ? 'This product is no longer available.'
    : item.product.isDemo ? 'Sample products cannot be purchased. Remove this item to continue.'
    : !variant ? 'This option is no longer available.'
    : item.listing && !item.offer?.available ? 'This seller offer is no longer available. Refresh or remove it.'
    : stock < 1 ? 'This option is out of stock.'
    : item.quantity > stock ? `Only ${stock} available. Reduce the quantity to continue.` : undefined;
  return { variant, price, stock, priceChanged: money(price) !== money(item.price), available: !reason, reason };
}
