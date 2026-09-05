'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { liveQueryOptions } from '@/lib/syncConfig';

const ORDER_STATUSES = ['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned'];

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter],
    queryFn: () => api.get(`/admin/orders?page=${page}&limit=15${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      showToast('Order status updated');
      setUpdatingId(null);
    },
    onError: (err: unknown) => {
      setUpdatingId(null);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed';
      showToast(msg, 'error');
    },
  });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'orderId', header: 'Order ID', render: (r) => <span className="font-mono text-xs text-violet-400">{r.orderId as string}</span>, sortable: true },
    { key: 'customer', header: 'Customer', render: (r) => <span>{(r.customer as { name: string })?.name}</span> },
    { key: 'paymentMethod', header: 'Payment', render: (r) => <span className="uppercase text-xs text-white/60">{r.paymentMethod as string}</span> },
    { key: 'total', header: 'Amount', render: (r) => <span className="text-acid-400 font-medium">{formatPrice(r.total as number)}</span>, sortable: true },
    { key: 'orderStatus', header: 'Status', render: (r) => <StatusBadge status={r.orderStatus as string} /> },
    { key: 'createdAt', header: 'Date', render: (r) => <span className="text-white/50 text-xs">{formatDate(r.createdAt as string)}</span>, sortable: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-syne text-2xl font-bold text-white">Orders</h1>
          <p className="text-white/50 text-sm mt-1">{data?.meta?.total || 0} total orders</p>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input text-sm py-2 pr-8 appearance-none cursor-pointer">
            <option value="">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data as Record<string, unknown>[]) || []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        onPageChange={setPage}
        emptyMessage="No orders found"
        rowIdKey="_id"
        expandableRender={(row) => {
          const items = (row.items as Array<Record<string, unknown>>) || [];
          const address = (row.shippingAddress as Record<string, string>) || {};
          return (
            <div className="space-y-4">
              {/* Customer */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm text-white">{(row.customer as { name?: string })?.name || '—'}</p>
              </div>

              {/* Items summary */}
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-1.5">
                  {items.length === 0 && <p className="text-xs text-white/40">No item data</p>}
                  {items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-white/70 truncate">
                        {(item.product as { name?: string })?.name || 'Item'}
                        <span className="text-white/40 text-xs"> × {String(item.quantity ?? 1)}</span>
                      </span>
                      <span className="text-white/70 shrink-0">{formatPrice((item.totalPrice as number) ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping address */}
              <div className="border-t border-white/5 pt-3 text-xs text-white/50">
                <p className="font-semibold text-white/40 uppercase tracking-wider mb-1">Shipping to</p>
                <p>{[address.fullName, address.phone].filter(Boolean).join(' • ') || '—'}</p>
                <p>{[address.addressLine1, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>
              </div>

              {/* Total */}
              <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Total</p>
                <p className="text-sm font-semibold text-acid-400">{formatPrice((row.total as number) ?? 0)}</p>
              </div>
            </div>
          );
        }}
        actions={(row, { isExpanded, toggleExpanded }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleExpanded}
              title={isExpanded ? 'Hide details' : 'View details'}
              aria-expanded={isExpanded}
              className="p-1.5 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
            >
              {isExpanded ? <ChevronUp size={14} /> : <Eye size={14} />}
            </button>
            <div className="relative" key={row.orderStatus as string}>
              <select
                defaultValue={row.orderStatus as string}
                onChange={(e) => { setUpdatingId(row._id as string); updateStatus.mutate({ id: row._id as string, status: e.target.value }); }}
                className="text-xs glass border border-white/10 rounded-lg px-2 py-1.5 appearance-none cursor-pointer text-white/70 hover:text-white pr-6"
                disabled={updatingId === row._id}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>
        )}
      />
    </div>
  );
}
