'use client';

import { useState, use, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, CheckCircle2, Pause, Play, Package } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { QueryError } from '@/components/common/QueryError';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Overlay } from '@/components/common/Overlay';

const updateSchema = z.object({
  price: z.number({ invalid_type_error: 'Required' }).min(1, 'Price must be at least ₹1'),
  compareAtPrice: z.number().optional().nullable(),
  condition: z.enum(['new', 'used', 'refurbished']),
  handlingTimeDays: z.number({ invalid_type_error: 'Required' }).min(0).max(30),
  fulfillmentMode: z.enum(['seller', 'nexmart']),
  returnWindowDays: z.number().min(0).max(90).optional().nullable(),
  warrantyText: z.string().optional(),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

export default function ListingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const { id } = use(params);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState('restock');
  const [adjustNote, setAdjustNote] = useState('');

  const query = useQuery({
    queryKey: ['seller', 'listings', id],
    queryFn: async () => (await api.get(`/seller/listings/${id}`)).data.data
  });

  const listing = query.data;

  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    values: listing ? {
      price: listing.pricePaise / 100,
      compareAtPrice: listing.compareAtPricePaise ? listing.compareAtPricePaise / 100 : undefined,
      condition: listing.condition,
      handlingTimeDays: listing.handlingTimeDays,
      fulfillmentMode: listing.fulfillmentMode,
      returnWindowDays: listing.returnWindowDays,
      warrantyText: listing.warrantyText || '',
    } : undefined
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateFormValues) => {
      const payload = {
        pricePaise: Math.round(data.price * 100),
        compareAtPricePaise: data.compareAtPrice ? Math.round(data.compareAtPrice * 100) : undefined,
        condition: data.condition,
        handlingTimeDays: data.handlingTimeDays,
        fulfillmentMode: data.fulfillmentMode,
        returnWindowDays: data.returnWindowDays,
        warrantyText: data.warrantyText,
      };
      return api.put(`/seller/listings/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings', id] });
      showToast('Listing updated successfully', 'success');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: async (action: 'submit' | 'pause' | 'resume') => api.post(`/seller/listings/${id}/${action}`),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings', id] });
      showToast(`Listing ${action === 'submit' ? 'submitted for review' : action === 'pause' ? 'paused' : 'resumed'}`, 'success');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  const inventoryMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = crypto.randomUUID();
      return api.post(`/seller/listings/${id}/inventory/adjust`, {
        delta: adjustDelta,
        reason: adjustReason,
        note: adjustNote,
        idempotencyKey,
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings', id] });
      showToast('Inventory adjusted', 'success');
      setAdjustModalOpen(false);
      setAdjustDelta(0);
      setAdjustNote('');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  if (query.isPending) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-white/10" />
        <div className="h-64 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (query.isError) {
    return <QueryError label="Listing details" detail={getApiError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const isEditable = listing.status === 'draft' || listing.status === 'approved' || listing.status === 'rejected';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/seller/listings" className="mb-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-white transition-colors">
            <ArrowLeft size={16} aria-hidden /> Back to listings
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-outfit text-3xl font-semibold">{listing.canonicalProduct?.name || listing.sellerSku}</h1>
            <StatusBadge status={listing.status} />
          </div>
          <p className="mt-2 text-sm text-secondary">SKU: {listing.sellerSku}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {listing.status === 'draft' && (
            <button type="button" onClick={() => statusMutation.mutate('submit')} disabled={statusMutation.isPending} className="btn-secondary min-h-11 px-4">
              {statusMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />} Submit for review
            </button>
          )}
          {listing.status === 'published' && (
            <button type="button" onClick={() => statusMutation.mutate('pause')} disabled={statusMutation.isPending} className="btn-secondary min-h-11 px-4 text-amber-300 hover:text-amber-200">
              {statusMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Pause listing
            </button>
          )}
          {listing.status === 'paused' && (
            <button type="button" onClick={() => statusMutation.mutate('resume')} disabled={statusMutation.isPending} className="btn-secondary min-h-11 px-4 text-acid-400 hover:text-acid-300">
              {statusMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Resume listing
            </button>
          )}
        </div>
      </div>

      {listing.rejectionReason && (
        <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-5">
          <h3 className="font-semibold text-red-300">Listing Rejected</h3>
          <p className="mt-1 text-sm text-secondary">{listing.rejectionReason}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6 rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6">
            <h2 className="font-outfit text-xl font-semibold">Listing Details</h2>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-secondary">Price (₹) *</span>
                <input {...register('price', { valueAsNumber: true })} disabled={!isEditable} type="number" min="0" step="1" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50" />
                {errors.price && <p className="text-xs text-red-400">{errors.price.message}</p>}
              </label>
              
              <label className="block space-y-2">
                <span className="text-sm text-secondary">Compare at price (₹)</span>
                <input {...register('compareAtPrice', { valueAsNumber: true, setValueAs: v => v === '' ? undefined : parseInt(v, 10) })} disabled={!isEditable} type="number" min="0" step="1" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50" />
                {errors.compareAtPrice && <p className="text-xs text-red-400">{errors.compareAtPrice.message}</p>}
              </label>
              
              <label className="block space-y-2">
                <span className="text-sm text-secondary">Condition *</span>
                <select {...register('condition')} disabled={!isEditable} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50">
                  <option value="new">New</option>
                  <option value="refurbished">Refurbished</option>
                  <option value="used">Used</option>
                </select>
                {errors.condition && <p className="text-xs text-red-400">{errors.condition.message}</p>}
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-secondary">Fulfillment Mode *</span>
                <select {...register('fulfillmentMode')} disabled={!isEditable} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50">
                  <option value="seller">Seller Direct</option>
                  <option value="nexmart">NexMart Fulfilled</option>
                </select>
                {errors.fulfillmentMode && <p className="text-xs text-red-400">{errors.fulfillmentMode.message}</p>}
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-secondary">Handling Time (Days) *</span>
                <input {...register('handlingTimeDays', { valueAsNumber: true })} disabled={!isEditable} type="number" min="0" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50" />
                {errors.handlingTimeDays && <p className="text-xs text-red-400">{errors.handlingTimeDays.message}</p>}
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-secondary">Return Window (Days)</span>
                <input {...register('returnWindowDays', { valueAsNumber: true, setValueAs: v => v === '' ? undefined : parseInt(v, 10) })} disabled={!isEditable} type="number" min="0" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50" />
                {errors.returnWindowDays && <p className="text-xs text-red-400">{errors.returnWindowDays.message}</p>}
              </label>
              
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-sm text-secondary">Warranty Text</span>
                <input {...register('warrantyText')} disabled={!isEditable} type="text" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50" />
                {errors.warrantyText && <p className="text-xs text-red-400">{errors.warrantyText.message}</p>}
              </label>
            </div>

            {isEditable && isDirty && (
              <div className="flex justify-end pt-4 border-t border-white/10">
                <button type="submit" disabled={updateMutation.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-black hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50">
                  {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
                  Save changes
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-outfit text-xl font-semibold">Inventory</h2>
              <button type="button" onClick={() => setAdjustModalOpen(true)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/15 px-3 text-xs font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
                Adjust
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-secondary">Available</span>
                <span className="font-medium">{listing.inventory?.available || 0}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-secondary">Reserved</span>
                <span className="font-medium text-amber-300">{listing.inventory?.reserved || 0}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-secondary">Committed</span>
                <span className="font-medium text-blue-300">{listing.inventory?.committed || 0}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-secondary">Returned</span>
                <span className="font-medium">{listing.inventory?.returned || 0}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-sm text-secondary">Damaged</span>
                <span className="font-medium text-red-300">{listing.inventory?.damaged || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6 flex flex-col items-center text-center">
            {listing.canonicalProduct?.imageBaseUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`${listing.canonicalProduct.imageBaseUrl}_400x400.jpg`} alt="" className="h-40 w-40 rounded-lg object-cover bg-white/5" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-white/5 text-muted"><Package size={48} aria-hidden /></div>
            )}
            <p className="mt-4 font-medium">{listing.canonicalProduct?.name || 'Unknown Product'}</p>
            <p className="mt-1 text-xs text-muted">ID: {listing.canonicalProduct?._id}</p>
          </div>
        </div>
      </div>

      <Overlay
        open={adjustModalOpen}
        onClose={() => { if (!inventoryMutation.isPending) setAdjustModalOpen(false); }}
        title="Adjust Inventory"
        description={`Update available stock for ${listing.sellerSku}`}
        busy={inventoryMutation.isPending}
        initialFocus="input"
        footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setAdjustModalOpen(false)} disabled={inventoryMutation.isPending} className="btn-secondary">Cancel</button><button type="button" onClick={() => inventoryMutation.mutate()} disabled={inventoryMutation.isPending || adjustDelta === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-violet-100 disabled:opacity-50">{inventoryMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Adjust</button></div>}
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-secondary">Quantity adjustment (positive or negative)</span>
            <input value={adjustDelta} onChange={(e) => setAdjustDelta(parseInt(e.target.value) || 0)} type="number" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" />
            <p className="text-xs text-secondary">New available: {(listing.inventory?.available || 0) + adjustDelta}</p>
          </label>
          
          <label className="block space-y-2">
            <span className="text-sm text-secondary">Reason</span>
            <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <option value="restock">Restock (+)</option>
              <option value="damage_reported">Damage Reported (-)</option>
              <option value="return_received">Return Received (+)</option>
              <option value="opening_balance">Opening Balance (+)</option>
            </select>
          </label>
          
          <label className="block space-y-2">
            <span className="text-sm text-secondary">Note (optional)</span>
            <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} type="text" maxLength={200} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" />
          </label>
        </div>
      </Overlay>
    </div>
  );
}
