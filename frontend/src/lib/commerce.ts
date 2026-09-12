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
  return variants.find(variant => variant.sku === sku) ?? variants.find(variant => variant.stock > 0) ?? variants[0];
}

export function variantLabel(variant: ProductVariant) {
  return Object.entries(variant.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || variant.sku;
}

export function getCartItemState(item: CartItem) {
  const variant = item.product?.variants?.find(option => option.sku === item.variant);
  const price = variant?.price ?? item.price;
  const reason = !item.product || item.product.isPublished === false ? 'This product is no longer available.'
    : !variant ? 'This option is no longer available.'
    : variant.stock < 1 ? 'This option is out of stock.'
    : item.quantity > variant.stock ? `Only ${variant.stock} available. Reduce the quantity to continue.` : undefined;
  return { variant, price, priceChanged: money(price) !== money(item.price), available: !reason, reason };
}
