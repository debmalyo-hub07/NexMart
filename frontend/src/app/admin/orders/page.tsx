'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { Eye, ChevronDown } from 'lucide-react';
import Link from 'next/link';
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
    queryKey: ['admin-orders', page, statusFilter],
    queryFn: () => api.get(`/admin/orders?page=${page}&limit=15${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      showToast('Order status updated');
      setUpdatingId(null);
    },
    onError: () => showToast('Update failed', 'error'),
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
        actions={(row) => (
          <div className="flex items-center gap-2">
            <Link href={`/orders/${row._id}`} className="p-1.5 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
              <Eye size={14} />
            </Link>
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
