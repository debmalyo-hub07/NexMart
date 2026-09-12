import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { formatPrice } from '@/lib/utils';
import type { OrderItem } from '@/types';

export function OrderItems({ items }: { items: OrderItem[] }) {
  return <ul className="divide-y divide-white/10">{items.map((item, index) => <li key={`${item.variant}-${index}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
    <div className="product-stage relative h-14 w-14 shrink-0 overflow-hidden rounded-lg sm:h-16 sm:w-16"><ProductImage src={item.image || item.product?.images?.[0]} alt="" sizes="64px" className="p-1" /></div>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.product?.slug ? <Link href={`/products/${item.product.slug}`} className="hover:text-violet-200">{item.name || item.product.name}</Link> : item.name || item.product?.name || 'Product no longer listed'}</p><p className="mt-1 break-words text-xs text-muted">{item.variant} · Quantity {item.quantity}</p><p className="mt-1 text-xs text-secondary">{formatPrice(item.unitPrice)} each</p><p className="mt-2 font-mono text-sm sm:hidden">{formatPrice(item.totalPrice)}</p></div>
    <p className="hidden shrink-0 font-mono text-sm sm:block">{formatPrice(item.totalPrice)}</p>
  </li>)}</ul>;
}
