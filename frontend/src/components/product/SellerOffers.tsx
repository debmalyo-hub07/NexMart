'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Loader2, Package, ShieldCheck, ShoppingCart, Star, Clock, ArrowDownUp } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { ApiResponse } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { EmptyState } from '@/components/common/EmptyState';

interface SellerOffer {
  id: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  condition: 'new' | 'used' | 'refurbished';
  handlingTimeDays: number;
  fulfillmentMode: 'seller' | 'nexmart';
  returnWindowDays: number;
  warrantyText?: string;
  inventory?: {
    available: number;
  };
  seller: {
    id: string;
    storefrontName: string;
    verification: 'verified' | 'standard';
    performance?: {
      ratingAverage?: number;
      ratingCount?: number;
    };
  };
  canonicalVariantSku?: string;
}

export function SellerOffers({ productId, currentSku }: { productId: string, currentSku: string }) {
  const [sortBy, setSortBy] = useState<'price' | 'rating' | 'speed'>('price');
  const [addingId, setAddingId] = useState<string | null>(null);
  
  const addItem = useCartStore(s => s.addItem);
  const cartBusy = useCartStore(s => s.isLoading);
  const toast = useUIStore(s => s.showToast);

  const { data, isPending, isError } = useQuery({
    queryKey: ['storefront', 'offers', productId],
    queryFn: ({ signal }) => api.get<ApiResponse<SellerOffer[]>>(`/products/${productId}/offers`, { signal }).then(r => r.data.data ?? []),
  });

  if (isPending) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 rounded bg-white/10" /><div className="h-32 rounded-xl bg-white/5" /></div>;
  if (isError) return null; // Fallback or silent fail if offers can't be loaded

  // Filter offers matching the current SKU
  const offers = (data || []).filter(offer => !offer.canonicalVariantSku || offer.canonicalVariantSku === currentSku);

  if (offers.length === 0) return null;

  const sortedOffers = [...offers].sort((a, b) => {
    if (sortBy === 'price') return a.pricePaise - b.pricePaise;
    if (sortBy === 'rating') return (b.seller.performance?.ratingAverage ?? 0) - (a.seller.performance?.ratingAverage ?? 0);
    if (sortBy === 'speed') return a.handlingTimeDays - b.handlingTimeDays;
    return 0;
  });

  // Determine best price offer for highlighting
  const lowestPrice = Math.min(...offers.map(o => o.pricePaise));

  const handleAdd = async (offer: SellerOffer) => {
    if (addingId || cartBusy) return;
    if (!offer.inventory?.available) return;
    
    setAddingId(offer.id);
    try {
      await addItem(productId, currentSku || offer.canonicalVariantSku || '', 1, offer.id);
      toast('Added to your cart');
    } catch (error: any) {
      toast(error?.response?.data?.message || 'Could not add to cart', 'error');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="mt-12 scroll-mt-24" id="seller-offers">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm text-violet-300">Marketplace</p>
          <h2 className="mt-1 font-outfit text-2xl font-semibold">Available from sellers</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <ArrowDownUp size={16} className="text-secondary" />
          <select 
            className="input min-h-10 border-transparent bg-white/5 py-1 text-sm focus:bg-space-800"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            aria-label="Sort offers"
          >
            <option value="price">Lowest Price</option>
            <option value="rating">Top Rated Sellers</option>
            <option value="speed">Fastest Dispatch</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedOffers.map(offer => {
          const isBestPrice = offer.pricePaise === lowestPrice;
          const isVerified = offer.seller.verification === 'verified';
          const stock = offer.inventory?.available || 0;
          const isAdding = addingId === offer.id;

          return (
            <div 
              key={offer.id} 
              className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${isBestPrice ? 'border-violet-400/30 bg-violet-500/5' : 'border-white/10 bg-space-900'} hover:border-white/30`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-medium truncate">
                      <Link href={`/sellers/${offer.seller.id}`} className="hover:text-violet-300 hover:underline truncate">
                        {offer.seller.storefrontName}
                      </Link>
                      {isVerified && <BadgeCheck size={16} className="text-violet-400 shrink-0" aria-label="NexMart Verified Seller" />}
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-secondary">
                      <span className="flex items-center gap-1">
                        <Star size={13} className={offer.seller.performance?.ratingAverage ? "text-amber-400" : "text-muted"} />
                        {offer.seller.performance?.ratingAverage ? `${offer.seller.performance.ratingAverage.toFixed(1)} (${offer.seller.performance.ratingCount})` : 'New seller'}
                      </span>
                      <span className="capitalize text-muted">{offer.condition}</span>
                    </div>
                  </div>
                  {isBestPrice && <span className="shrink-0 rounded bg-acid-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-acid-400">Best Price</span>}
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xl font-semibold">{formatPrice(offer.pricePaise / 100)}</span>
                  {offer.compareAtPricePaise && offer.compareAtPricePaise > offer.pricePaise && (
                    <del className="text-xs text-muted font-mono">{formatPrice(offer.compareAtPricePaise / 100)}</del>
                  )}
                </div>

                <ul className="space-y-2 text-xs text-secondary">
                  <li className="flex items-center gap-2">
                    <Clock size={14} className="shrink-0" />
                    <span>Dispatches in {offer.handlingTimeDays} {offer.handlingTimeDays === 1 ? 'day' : 'days'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck size={14} className="shrink-0" />
                    <span>{offer.returnWindowDays > 0 ? `${offer.returnWindowDays}-day return window` : 'No returns'}</span>
                  </li>
                  {offer.fulfillmentMode === 'nexmart' && (
                    <li className="flex items-center gap-2 text-violet-300">
                      <Package size={14} className="shrink-0" />
                      <span>Fulfilled by NexMart</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className={stock > 0 ? (stock < 5 ? 'text-amber-300' : 'text-emerald-400') : 'text-red-400'}>
                    {stock > 0 ? (stock < 5 ? `Only ${stock} left` : 'In stock') : 'Out of stock'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(offer)}
                  disabled={isAdding || cartBusy || stock === 0}
                  className="btn-secondary w-full"
                >
                  {isAdding ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />}
                  {isAdding ? 'Adding…' : 'Add to cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
