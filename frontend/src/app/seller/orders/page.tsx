'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Clock3, Loader2, PackageOpen, XCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';
import { formatPrice, formatDate } from '@/lib/utils';

type FulfillmentGroupStatus = 'placed' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';

type FulfillmentGroup = {
  id: string;
  groupId: string;
  status: FulfillmentGroupStatus;
  items: { name: string; variant: string; quantity: number; unitPricePaise: number }[];
  totalPaise: number;
  orderSummary?: { orderId: string; paymentStatus: string; createdAt: string };
};

type OrdersResponse = { data: FulfillmentGroup[]; meta: { page: number; total: number; totalPages: number } };

const actions: Partial<Record<FulfillmentGroupStatus, { next: FulfillmentGroupStatus; label: string; tone: 'primary' | 'danger' }[]>> = {
  placed: [{ next: 'confirmed', label: 'Confirm', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
  confirmed: [{ next: 'processing', label: 'Start processing', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
  processing: [{ next: 'ready_for_pickup', label: 'Ready for pickup', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
};
const reasonRequired = new Set<FulfillmentGroupStatus>(['cancelled']);

export default function SellerOrdersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ group: FulfillmentGroup; next: FulfillmentGroupStatus } | null>(null);
  const [note, setNote] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '10', page: String(page) });
    if (status) params.set('status', status);
    return params.toString();
  }, [status, page]);

  const orders = useQuery({ queryKey: ['seller', 'orders', queryString], queryFn: async () => (await api.get(`/seller/fulfillment-groups?${queryString}`)).data as OrdersResponse });
  
  const update = useMutation({
    mutationFn: async ({ group, next, note }: { group: FulfillmentGroup; next: FulfillmentGroupStatus; note?: string }) => api.patch(`/seller/fulfillment-groups/${group.id}/status`, { status: next, ...(note ? { note } : {}) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] }); showToast('Order status updated', 'success'); setSelected(null); setNote(''); },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  function requestAction(group: FulfillmentGroup, next: FulfillmentGroupStatus) {
    if (reasonRequired.has(next)) { setSelected({ group, next }); setNote(''); return; }
    update.mutate({ group, next });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-violet-300">Fulfillment</p>
          <h1 className="mt-1 font-outfit text-3xl font-semibold">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">Manage customer orders assigned to your store.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <option value="">All statuses</option>
              {['placed', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        </div>
      </div>
      
      {orders.isPending ? (
        <div className="space-y-2" aria-label="Loading orders">
          {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />)}
        </div>
      ) : orders.isError ? (
        <QueryError label="Orders" detail={getApiError(orders.error)} onRetry={() => void orders.refetch()} />
      ) : !orders.data?.data.length ? (
        <EmptyState icon={PackageOpen} title="No orders found" description="Orders matching your filter will appear here." />
      ) : (
        <section className="space-y-4" aria-label="Orders list">
          {orders.data.data.map((group) => (
            <article key={group.id} className="rounded-xl border border-white/10 bg-space-900/50 p-5 hover:bg-space-900">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-outfit text-lg font-semibold"><Link href={`/seller/orders/${group.id}`} className="hover:underline hover:text-violet-300">{group.groupId}</Link></h2>
                    <StatusBadge status={group.status} />
                  </div>
                  {group.orderSummary && (
                    <p className="mt-1 text-sm text-secondary">
                      Order {group.orderSummary.orderId} · Placed {formatDate(group.orderSummary.createdAt)} · Payment: <span className="capitalize">{group.orderSummary.paymentStatus}</span>
                    </p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {group.items.map((item, i) => (
                      <li key={i} className="text-sm text-white">
                        {item.quantity}x {item.name} {item.variant ? `(${item.variant})` : ''} - {formatPrice(item.unitPricePaise / 100)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 font-semibold text-white">Total: {formatPrice(group.totalPaise / 100)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <Link href={`/seller/orders/${group.id}`} className="btn-secondary min-h-11 px-3">
                    <FileText size={15} aria-hidden /> View details
                  </Link>
                  {(actions[group.status] || []).map((action) => (
                    <button key={action.next} type="button" disabled={update.isPending} onClick={() => requestAction(group, action.next)} className={action.tone === 'danger' ? 'btn-danger min-h-11 px-3' : 'bg-white text-black hover:bg-violet-100 min-h-11 rounded-lg px-3 text-sm font-semibold'}>
                      {action.next === 'cancelled' ? <XCircle size={15} aria-hidden className="inline mr-1.5" /> : <CheckCircle2 size={15} aria-hidden className="inline mr-1.5" />}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {orders.data.meta.totalPages > 1 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <Pagination page={orders.data.meta.page} totalPages={orders.data.meta.totalPages} onPageChange={setPage} />
            </div>
          )}
        </section>
      )}

      <Overlay
        open={Boolean(selected)}
        onClose={() => { if (!update.isPending) setSelected(null); }}
        title={selected ? `Cancel ${selected.group.groupId}` : 'Order action'}
        description="Please provide a reason for cancelling this fulfillment group."
        busy={update.isPending}
        initialFocus="textarea"
        footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} disabled={update.isPending} className="btn-secondary">Keep order</button><button type="button" onClick={() => selected && update.mutate({ group: selected.group, next: selected.next, note: note.trim() })} disabled={update.isPending || !note.trim()} className="btn-danger">{update.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Clock3 size={16} aria-hidden />} Confirm cancellation</button></div>}
      >
        <label className="block space-y-2 text-sm text-secondary">
          <span>Cancellation reason</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1000} className="w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="E.g., Out of stock, pricing error, etc." />
        </label>
      </Overlay>
    </div>
  );
}
