'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { formatDate, formatPrice } from '@/lib/utils';
import { Truck, MapPin, Package, ChevronDown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ClockCalendar } from '@/components/common/ClockCalendar';
import { liveQueryOptions } from '@/lib/syncConfig';

// 'assigned' is the model default (display-only — the backend won't accept it as an update target)
const DELIVERY_STATUSES = ['assigned', 'picked', 'out_for_delivery', 'delivered', 'attempted', 'returned'];

export default function DeliveryDashboardPage() {
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  // Phase 8 — Auto-sync every 20 seconds (lightweight polling, no UI freeze)
  const { data, isLoading } = useQuery({
    queryKey: ['delivery', 'my-deliveries', page],
    queryFn: () => api.get(`/delivery/my-orders?page=${page}&limit=10`).then((r) => r.data),
    ...liveQueryOptions,
  });

  // Stats fetch — one large page (the backend caps limit at 100) so the stat
  // cards count across all of the agent's recent assignments instead of just
  // the 10 rows on the currently visible table page. Keyed under
  // ['delivery', 'my-deliveries'] so status updates invalidate it too.
  const { data: statsData } = useQuery({
    queryKey: ['delivery', 'my-deliveries', 'stats'],
    queryFn: () => api.get('/delivery/my-orders?page=1&limit=100').then((r) => r.data),
    ...liveQueryOptions,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/delivery/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my-deliveries'] });
      showToast('Status updated');
      setUpdatingId(null);
    },
    onError: () => { showToast('Update failed', 'error'); setUpdatingId(null); },
  });

  const assignments = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  // Stat cards count over the full recent assignment list (stats fetch above),
  // not the current table page — so the numbers no longer change when the
  // agent paginates the table.
  const statsAssignments: Record<string, unknown>[] = statsData?.data || [];

  const isToday = (value: unknown): boolean => {
    if (!value) return false;
    const date = new Date(value as string);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const outForDeliveryCount = statsAssignments.filter((a: Record<string, unknown>) => {
    const order = a.order as { orderStatus: string } | null;
    return order?.orderStatus === 'out_for_delivery';
  }).length;

  const deliveredTodayCount = statsAssignments.filter((a: Record<string, unknown>) => {
    return a.status === 'delivered' && isToday(a.deliveredAt);
  }).length;

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'orderId', header: 'Order',
      render: (r) => {
        const order = r.order as { orderId: string; total: number };
        return (
          <div>
            <p className="font-mono text-xs text-violet-400">{order?.orderId}</p>
            <p className="text-xs text-acid-400">{formatPrice(order?.total || 0)}</p>
          </div>
        );
      },
    },
    {
      key: 'customer', header: 'Customer',
      render: (r) => {
        const order = r.order as { customer: { name: string }; shippingAddress: { phone?: string } };
        return (
          <div>
            <p className="text-sm text-white">{order?.customer?.name}</p>
            <a
              href={`tel:${order?.shippingAddress?.phone || ''}`}
              className="text-xs text-white/40"
            >
              {order?.shippingAddress?.phone || 'No phone on file'}
            </a>
          </div>
        );
      },
    },
    {
      key: 'address', header: 'Deliver To',
      render: (r) => {
        const order = r.order as { shippingAddress: { addressLine1: string; city: string; pincode: string } };
        return (
          <div className="flex items-start gap-1.5">
            <MapPin size={12} className="text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-white/70 line-clamp-1">{order?.shippingAddress?.addressLine1}</p>
              <p className="text-xs text-white/40">{order?.shippingAddress?.city} - {order?.shippingAddress?.pincode}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
    { key: 'assignedAt', header: 'Assigned', render: (r) => <span className="text-white/50 text-xs">{formatDate(r.assignedAt as string)}</span> },
  ];

  return (
    <div className="page-container py-8 space-y-6">
        {/* Clock/Calendar Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col justify-center">
            <p className="text-white/50 text-base leading-relaxed">
              Manage your assigned shipments and track your delivery performance for today.
            </p>
          </div>
          <div className="flex lg:justify-end">
            <div className="w-full max-w-[650px]">
              <ClockCalendar />
            </div>
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 border border-violet-500/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400"><Truck size={18} /></div>
              <p className="text-sm text-white/60">Out for Delivery</p>
            </div>
            <p className="font-syne text-3xl font-bold text-violet-400">{outForDeliveryCount}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 border border-acid-400/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-acid-400/10 text-acid-400"><Package size={18} /></div>
              <p className="text-sm text-white/60">Delivered Today</p>
            </div>
            <p className="font-syne text-3xl font-bold text-acid-400">{deliveredTodayCount}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-5 border border-white/5 sm:col-span-1 col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-white/5"><Package size={18} className="text-white/40" /></div>
              <p className="text-sm text-white/60">Total Assigned</p>
            </div>
            <p className="font-syne text-3xl font-bold text-white">{data?.meta?.total || 0}</p>
          </motion.div>
        </div>

        {/* My Deliveries Table */}
        <div>
          <h2 className="font-syne font-semibold text-white mb-4">My Assigned Orders</h2>
          <DataTable
            columns={columns}
            data={(assignments as Record<string, unknown>[]) || []}
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            emptyMessage="No deliveries assigned yet"
            actions={(row) => (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    defaultValue={row.status as string}
                    onChange={(e) => {
                      const orderId = (row.order as { _id: string })?._id;
                      if (!orderId || !e.target.value) return;
                      setUpdatingId(orderId);
                      updateStatus.mutate({ id: orderId, status: e.target.value });
                    }}
                    className="text-xs glass border border-white/10 rounded-lg px-2 py-1.5 appearance-none cursor-pointer text-white/70 hover:text-white pr-6"
                  >
                    {DELIVERY_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  {updatingId === (row.order as { _id: string })?._id ? (
                    <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-violet-400 animate-spin" />
                  ) : (
                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  )}
                </div>
              </div>
            )}
          />
        </div>
      </div>
    );
  }
