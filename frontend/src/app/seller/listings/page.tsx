'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Loader2, Pause, Play, Plus, Search, Package } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { useUIStore } from '@/store/uiStore';

type ListingState = 'draft' | 'submitted' | 'moderation' | 'approved' | 'published' | 'rejected' | 'paused' | 'suspended' | 'blocked';
type ListingRow = {
  _id: string;
  sellerSku: string;
  pricePaise: number;
  condition: string;
  status: ListingState;
  inventory: { available: number; reserved: number; committed: number };
  canonicalProduct?: { _id: string; name: string; imageBaseUrl?: string };
  rejectionReason?: string;
  createdAt: string;
};
type ListingResponse = { data: ListingRow[]; meta: { page: number; total: number; totalPages: number } };

export default function SellerListingsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '20', page: page.toString() });
    if (status) params.set('status', status);
    return params.toString();
  }, [status, page]);

  const query = useQuery({
    queryKey: ['seller', 'listings', queryString],
    queryFn: async () => (await api.get(`/seller/listings?${queryString}`)).data as ListingResponse
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/seller/listings/${id}/submit`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] });
      showToast('Listing submitted for review', 'success');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/seller/listings/${id}/pause`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] });
      showToast('Listing paused', 'success');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/seller/listings/${id}/resume`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] });
      showToast('Listing resumed', 'success');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-violet-300">Catalog</p>
          <h1 className="mt-1 font-outfit text-3xl font-semibold">Listings</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">Manage your product offerings and inventory across the marketplace.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <option value="">All statuses</option>
              {['draft','submitted','moderation','approved','published','rejected','paused','suspended','blocked'].map((val) => (
                <option key={val} value={val}>{val.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <Link href="/seller/listings/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
            <Plus size={16} aria-hidden /> New listing
          </Link>
        </div>
      </div>

      {query.isPending ? (
        <div className="space-y-2" aria-label="Loading listings">
          {[0,1,2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />)}
        </div>
      ) : query.isError ? (
        <QueryError label="Listings" detail={getApiError(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data?.data.length ? (
        <EmptyState icon={Package} title="No listings found" description={status ? "Try changing your status filter." : "Create your first product listing to start selling."} action={!status ? <Link href="/seller/listings/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-violet-100"><Plus size={16} aria-hidden /> New listing</Link> : undefined} />
      ) : (
        <>
          <section className="space-y-4" aria-label="Your listings">
            {query.data.data.map((listing) => (
              <article key={listing._id} className="grid gap-4 rounded-xl border border-white/10 bg-space-900 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex gap-4 min-w-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5 border border-white/10">
                    {listing.canonicalProduct?.imageBaseUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`${listing.canonicalProduct.imageBaseUrl}_400x400.jpg`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted"><Package size={24} aria-hidden /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/seller/listings/${listing._id}`} className="truncate font-outfit text-lg font-semibold hover:text-violet-300 focus-visible:outline-none focus-visible:underline">
                        {listing.canonicalProduct?.name || 'Unknown Product'}
                      </Link>
                      <StatusBadge status={listing.status} />
                    </div>
                    <p className="mt-1 text-sm text-secondary">SKU: {listing.sellerSku} · {listing.condition}</p>
                    <p className="mt-1 font-medium text-white">₹{(listing.pricePaise / 100).toLocaleString('en-IN')}</p>
                    {listing.rejectionReason && <p className="mt-2 text-sm text-red-300">Rejection: {listing.rejectionReason}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-xs text-muted">Available</p>
                    <p className="mt-0.5 font-medium">{listing.inventory.available}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-xs text-muted">Reserved</p>
                    <p className="mt-0.5 font-medium">{listing.inventory.reserved}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-xs text-muted">Committed</p>
                    <p className="mt-0.5 font-medium">{listing.inventory.committed}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {listing.status === 'draft' && (
                    <button type="button" onClick={() => submitMutation.mutate(listing._id)} disabled={submitMutation.isPending} className="btn-secondary min-h-11 px-3">
                      {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />} Submit
                    </button>
                  )}
                  {listing.status === 'published' && (
                    <button type="button" onClick={() => pauseMutation.mutate(listing._id)} disabled={pauseMutation.isPending} className="btn-secondary min-h-11 px-3 text-amber-300 hover:text-amber-200">
                      {pauseMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Pause
                    </button>
                  )}
                  {listing.status === 'paused' && (
                    <button type="button" onClick={() => resumeMutation.mutate(listing._id)} disabled={resumeMutation.isPending} className="btn-secondary min-h-11 px-3 text-acid-400 hover:text-acid-300">
                      {resumeMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Resume
                    </button>
                  )}
                  <Link href={`/seller/listings/${listing._id}`} className="btn-secondary min-h-11 px-3">
                    <ChevronRight size={16} aria-hidden /> Manage
                  </Link>
                </div>
              </article>
            ))}
          </section>
          
          <div className="mt-6">
            <Pagination page={query.data.meta.page} totalPages={query.data.meta.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
