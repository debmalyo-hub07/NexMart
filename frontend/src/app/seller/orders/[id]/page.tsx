'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, ChevronLeft, Clock3, FileText, Loader2, Package, Truck, XCircle } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';
import { formatPrice, formatDate } from '@/lib/utils';
import { ProductImage } from '@/components/product/ProductImage';

type FulfillmentGroupStatus = 'placed' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';

type FulfillmentGroupDetail = {
  id: string;
  groupId: string;
  status: FulfillmentGroupStatus;
  items: { name: string; image?: string; variant: string; quantity: number; unitPricePaise: number }[];
  totalPaise: number;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  orderSummary?: { orderId: string; orderStatus: string; paymentStatus: string; paymentMethod: string; taxStatus?: string; createdAt: string };
  shippingAddress?: { fullName: string; addressLine1: string; addressLine2?: string; city: string; state: string; pincode: string; phone: string };
  statusHistory?: { status: string; timestamp: string; note?: string }[];
  shipment?: string | { shipmentId: string; trackingId?: string; status: string };
};

const actions: Partial<Record<FulfillmentGroupStatus, { next: FulfillmentGroupStatus; label: string; tone: 'primary' | 'danger' }[]>> = {
  placed: [{ next: 'confirmed', label: 'Confirm', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
  confirmed: [{ next: 'processing', label: 'Start processing', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
  processing: [{ next: 'ready_for_pickup', label: 'Ready for pickup', tone: 'primary' }, { next: 'cancelled', label: 'Cancel', tone: 'danger' }],
};
const reasonRequired = new Set<FulfillmentGroupStatus>(['cancelled']);

export default function SellerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  
  const [selected, setSelected] = useState<{ next: FulfillmentGroupStatus } | null>(null);
  const [note, setNote] = useState('');

  const order = useQuery({ queryKey: ['seller', 'orders', id], queryFn: async () => (await api.get(`/seller/fulfillment-groups/${id}`)).data.data as FulfillmentGroupDetail });
  
  const update = useMutation({
    mutationFn: async ({ next, note }: { next: FulfillmentGroupStatus; note?: string }) => api.patch(`/seller/fulfillment-groups/${id}/status`, { status: next, ...(note ? { note } : {}) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] }); showToast('Order status updated', 'success'); setSelected(null); setNote(''); },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  const createShipment = useMutation({
    mutationFn: async () => api.post(`/seller/fulfillment-groups/${id}/shipment`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] }); showToast('Shipment created successfully', 'success'); },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  function requestAction(next: FulfillmentGroupStatus) {
    if (reasonRequired.has(next)) { setSelected({ next }); setNote(''); return; }
    update.mutate({ next });
  }

  if (order.isPending) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 rounded bg-white/10" /><div className="h-64 rounded-xl bg-white/10" /></div>;
  if (order.isError) return <QueryError label="Order details" detail={getApiError(order.error)} onRetry={() => void order.refetch()} />;
  if (!order.data) return null;

  const group = order.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/seller/orders" className="mb-4 inline-flex items-center text-sm text-violet-300 hover:text-violet-200">
          <ChevronLeft size={16} className="mr-1" /> Back to orders
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-outfit text-3xl font-semibold">Order {group.groupId}</h1>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={group.status} />
              <span className="text-sm text-muted">{group.orderSummary?.createdAt ? formatDate(group.orderSummary.createdAt) : ''}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {(actions[group.status] || []).map((action) => (
              <button key={action.next} type="button" disabled={update.isPending} onClick={() => requestAction(action.next)} className={action.tone === 'danger' ? 'btn-danger min-h-11 px-4' : 'bg-white text-black hover:bg-violet-100 min-h-11 rounded-lg px-4 text-sm font-semibold'}>
                {action.next === 'cancelled' ? <XCircle size={15} aria-hidden className="inline mr-1.5" /> : <CheckCircle2 size={15} aria-hidden className="inline mr-1.5" />}
                {action.label}
              </button>
            ))}
            {group.status === 'ready_for_pickup' && !group.shipment && (
              <button type="button" disabled={createShipment.isPending} onClick={() => createShipment.mutate()} className="bg-white text-black hover:bg-violet-100 min-h-11 rounded-lg px-4 text-sm font-semibold">
                {createShipment.isPending ? <Loader2 size={15} className="inline mr-1.5 animate-spin" /> : <Package size={15} className="inline mr-1.5" />}
                Create shipment
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-white/10 bg-space-900/50 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Items</h2>
            <div className="divide-y divide-white/10">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="product-stage relative h-16 w-16 shrink-0 rounded-lg"><ProductImage src={item.image} alt="" sizes="64px" className="p-1" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{item.name}</p>
                    {item.variant && <p className="text-sm text-secondary">Variant: {item.variant}</p>}
                    <p className="text-sm text-secondary">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-white">{formatPrice(item.unitPricePaise / 100)}</p>
                </div>
              ))}
            </div>
          </section>

          {group.shipment && typeof group.shipment === 'object' && (
            <section className="rounded-xl border border-white/10 bg-space-900/50 p-5">
              <h2 className="mb-4 flex items-center text-lg font-semibold text-white"><Truck className="mr-2" size={20} /> Shipment Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted">Shipment ID</p>
                  <p className="text-white">{group.shipment.shipmentId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Tracking ID</p>
                  <p className="text-white">{group.shipment.trackingId || 'Pending'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Status</p>
                  <div className="mt-1"><StatusBadge status={group.shipment.status} /></div>
                </div>
              </div>
            </section>
          )}

          {group.statusHistory && group.statusHistory.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-space-900/50 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">History</h2>
              <div className="space-y-4 border-l border-white/20 ml-2">
                {group.statusHistory.map((h, i) => (
                  <div key={i} className="relative pl-6">
                    <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-violet-500 ring-4 ring-space-950" />
                    <p className="text-sm font-medium text-white capitalize">{h.status.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-secondary">{formatDate(h.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    {h.note && <p className="mt-1 text-sm text-muted">Note: {h.note}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-white/10 bg-space-900/50 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Customer & Shipping</h2>
            {group.shippingAddress ? (
              <div className="text-sm text-secondary">
                <p className="font-medium text-white">{group.shippingAddress.fullName}</p>
                <p className="mt-1">{group.shippingAddress.addressLine1}</p>
                {group.shippingAddress.addressLine2 && <p>{group.shippingAddress.addressLine2}</p>}
                <p>{group.shippingAddress.city}, {group.shippingAddress.state} {group.shippingAddress.pincode}</p>
                <p className="mt-2">Phone: {group.shippingAddress.phone}</p>
              </div>
            ) : (
              <p className="text-sm text-secondary">Address not available</p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-space-900/50 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Subtotal</span>
                <span className="text-white">{formatPrice(group.subtotalPaise / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Shipping</span>
                <span className="text-white">{formatPrice(group.shippingPaise / 100)}</span>
              </div>
              {group.orderSummary?.taxStatus === 'complete' && <div className="flex justify-between">
                <span className="text-secondary">Included GST</span>
                <span className="text-white">{formatPrice(group.taxPaise / 100)}</span>
              </div>}
              {group.discountPaise > 0 && (
                <div className="flex justify-between text-acid-400">
                  <span>Discount</span>
                  <span>-{formatPrice(group.discountPaise / 100)}</span>
                </div>
              )}
              <div className="my-2 border-t border-white/10" />
              <div className="flex justify-between font-semibold">
                <span className="text-white">Total</span>
                <span className="text-white">{formatPrice(group.totalPaise / 100)}</span>
              </div>
              {group.orderSummary && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-muted uppercase tracking-wider">Payment Status</p>
                  <p className="mt-1 capitalize text-white">{group.orderSummary.paymentStatus}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Overlay
        open={Boolean(selected)}
        onClose={() => { if (!update.isPending) setSelected(null); }}
        title={selected ? `Cancel Order` : 'Order action'}
        description="Please provide a reason for cancelling this fulfillment group."
        busy={update.isPending}
        initialFocus="textarea"
        footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} disabled={update.isPending} className="btn-secondary">Keep order</button><button type="button" onClick={() => selected && update.mutate({ next: selected.next, note: note.trim() })} disabled={update.isPending || !note.trim()} className="btn-danger">{update.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Clock3 size={16} aria-hidden />} Confirm cancellation</button></div>}
      >
        <label className="block space-y-2 text-sm text-secondary">
          <span>Cancellation reason</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1000} className="w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="E.g., Out of stock, pricing error, etc." />
        </label>
      </Overlay>
    </div>
  );
}
