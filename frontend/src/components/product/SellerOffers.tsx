'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Clock, Info, Loader2, ShoppingBag, Star } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { lowestAvailablePrice, matchingOffers, type OfferSort, type SellerOffer } from '@/lib/sellerOffers';
import type { ApiResponse } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { QueryError } from '@/components/common/QueryError';
import { Select } from '@/components/common/Select';

export function SellerOffers({ productId, currentSku }: { productId: string; currentSku: string }) {
  const [sort, setSort] = useState<OfferSort>('price');
  const [adding, setAdding] = useState('');
  const pending = useRef(false);
  const addItem = useCartStore(state => state.addItem);
  const busy = useCartStore(state => state.isLoading);
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const toast = useUIStore(state => state.showToast);
  const query = useQuery({ queryKey: ['storefront', 'offers', productId], queryFn: ({ signal }) => api.get<ApiResponse<SellerOffer[]>>(`/products/${productId}/offers`, { signal }).then(response => response.data.data ?? []), staleTime: 30_000 });
  const offers = matchingOffers(query.data ?? [], currentSku, sort);
  const lowest = lowestAvailablePrice(offers);
  async function add(offer: SellerOffer) {
    if (pending.current || busy || !offer.inventory?.available || !currentSku) return;
    pending.current = true; setAdding(offer.id);
    try { await addItem(productId, currentSku, 1, offer.id); toast('Seller offer added to your cart'); }
    catch (error) { toast(getApiError(error), 'error'); }
    finally { pending.current = false; setAdding(''); }
  }
  return <section className="policy-content mt-7 border-t border-white/15 pt-6" id="seller-offers">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">Seller options</h2>{offers.length > 1 && <Select id="seller-offer-sort" label="Sort seller offers" value={sort} onChange={value => setSort(value as OfferSort)} options={[{ value: 'price', label: 'Lowest price' }, { value: 'rating', label: 'Seller rating' }, { value: 'speed', label: 'Dispatch estimate' }]} />}</div>
    {query.isError ? <QueryError label="Seller offers" onRetry={() => void query.refetch()} /> : query.isPending ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted"><Loader2 size={16} className="animate-spin" aria-hidden />Checking seller options…</p> : !offers.length ? <p className="text-sm text-muted">No additional seller offers for this option.</p> : <div className="space-y-3">{offers.map(offer => {
      const stock = offer.inventory?.available ?? 0;
      return <article key={offer.id} className="rounded-xl border border-white/20 bg-space-800 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/sellers/${offer.seller.id}`} className="inline-flex min-h-11 items-center gap-1.5 break-words text-sm font-medium underline decoration-white/20 underline-offset-4">{offer.seller.storefrontName}{offer.seller.verification === 'verified' && <BadgeCheck size={16} className="shrink-0 text-violet-200" aria-label="Seller verification recorded" />}</Link><p className="flex flex-wrap items-center gap-2 text-xs text-muted"><span className="capitalize">{offer.condition}</span>{!!offer.seller.performance?.ratingCount && <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden />{offer.seller.performance.ratingAverage?.toFixed(1)} ({offer.seller.performance.ratingCount})</span>}</p></div><div className="shrink-0 text-right"><p className="font-mono text-lg">{formatPrice(offer.pricePaise / 100)}</p>{offers.length > 1 && stock > 0 && offer.pricePaise === lowest && <p className="mt-1 text-xs text-secondary">Lowest available price</p>}</div></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary"><p className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden />Seller handling: {offer.handlingTimeDays} {offer.handlingTimeDays === 1 ? 'day' : 'days'}</p><Link href="/returns" className="inline-flex items-center gap-1.5 underline underline-offset-4"><Info size={14} aria-hidden />{offer.returnWindowDays > 0 ? `Seller-stated ${offer.returnWindowDays}-day return window` : 'No voluntary return window stated'}</Link></div>
        {offer.warrantyText && <p className="mt-3 text-xs text-secondary">Seller warranty: {offer.warrantyText}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-3"><p className="flex items-center gap-1.5 text-xs text-secondary"><Info size={14} aria-hidden />{stock > 0 ? 'Available from this seller' : 'Currently unavailable'}</p>{!admin && <button type="button" onClick={() => void add(offer)} disabled={busy || !!adding || stock < 1 || !currentSku} className="btn-secondary px-3 text-xs">{adding === offer.id ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ShoppingBag size={15} aria-hidden />}{adding === offer.id ? 'Adding…' : 'Choose this seller'}</button>}</div>
      </article>;
    })}<p className="text-xs leading-relaxed text-muted">Handling times are seller estimates, not guaranteed arrival dates. Statutory consumer rights still apply.</p></div>}
  </section>;
}
