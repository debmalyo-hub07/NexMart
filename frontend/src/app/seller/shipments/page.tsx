'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, ChevronRight, MapPin, Calendar, Package } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { formatDate } from '@/lib/utils';

type ShipmentItem = {
  orderItemId: string;
  name: string;
  variant: string;
  quantity: number;
};

type ShipmentRow = {
  _id: string;
  shipmentId: string;
  trackingId?: string;
  status: string;
  destination: {
    name?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    pincode?: string;
  };
  items: ShipmentItem[];
  order?: {
    _id: string;
    orderId: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
  };
  fulfillmentGroup?: {
    _id: string;
    groupId: string;
    status: string;
    totalPaise: number;
  };
  createdAt: string;
};

type ShipmentsResponse = {
  data: ShipmentRow[];
  meta: { page: number; total: number; totalPages: number };
};

export default function SellerShipmentsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '15', page: String(page) });
    if (status) params.set('status', status);
    return params.toString();
  }, [status, page]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['seller', 'shipments', queryString],
    queryFn: async () => (await api.get(`/seller/shipments?${queryString}`)).data as ShipmentsResponse,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-violet-300">Logistics & Dispatches</p>
          <h1 className="mt-1 font-outfit text-3xl font-semibold">Shipments</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            Monitor packages handed over for pickup, transit, and customer delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <option value="">All dispatch statuses</option>
              {[
                'created',
                'ready_for_pickup',
                'picked_up',
                'in_transit',
                'out_for_delivery',
                'delivered',
                'delivery_failed',
                'returned',
                'cancelled',
              ].map((val) => (
                <option key={val} value={val}>
                  {val.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3" aria-label="Loading shipments">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : isError ? (
        <QueryError label="Shipments" detail={getApiError(error)} onRetry={() => void refetch()} />
      ) : !data?.data.length ? (
        <EmptyState
          icon={Truck}
          title="No shipments found"
          description={status ? 'No shipments match the selected filter.' : 'When your orders are marked ready for pickup, created shipments will appear here.'}
        />
      ) : (
        <section className="space-y-4" aria-label="Shipments list">
          {data.data.map((shipment) => (
            <article
              key={shipment._id}
              className="grid gap-4 rounded-xl border border-white/10 bg-space-900/50 p-5 hover:bg-space-900 transition-colors sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_auto] sm:items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-outfit text-lg font-semibold text-white">
                    {shipment.shipmentId}
                  </h2>
                  <StatusBadge status={shipment.status} />
                </div>
                <p className="text-sm text-secondary">
                  Tracking: <span className="font-mono text-white">{shipment.trackingId || 'Awaiting carrier scan'}</span>
                </p>
                {shipment.fulfillmentGroup && (
                  <p className="text-xs text-muted">
                    Group: {shipment.fulfillmentGroup.groupId}
                  </p>
                )}
                {shipment.order && (
                  <p className="text-xs text-muted">
                    Order: {shipment.order.orderId}
                  </p>
                )}
              </div>

              <div className="space-y-1 text-sm text-secondary">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="shrink-0 text-violet-300" />
                  <span className="truncate">
                    {shipment.destination?.city
                      ? `${shipment.destination.city}, ${shipment.destination.state || ''} ${shipment.destination.pinCode || shipment.destination.pincode || ''}`
                      : 'Destination address attached'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Calendar size={14} className="shrink-0" />
                  <span>Created {formatDate(shipment.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Package size={14} className="shrink-0" />
                  <span>{shipment.items?.reduce((sum, item) => sum + item.quantity, 0) || 1} unit(s) enclosed</span>
                </div>
              </div>

              <div className="flex items-center sm:justify-end">
                {shipment.fulfillmentGroup?._id ? (
                  <Link
                    href={`/seller/orders/${shipment.fulfillmentGroup._id}`}
                    className="btn-secondary min-h-11 px-3 text-sm"
                  >
                    View group <ChevronRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <span className="text-xs text-muted">Managed via order</span>
                )}
              </div>
            </article>
          ))}

          {data.meta.totalPages > 1 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
