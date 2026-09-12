'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { DataTable, Column, SortState } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/store/uiStore';
import { formatPrice, formatDate } from '@/lib/utils';
import { adminStatusActions, type StatusAction } from '@/lib/orderStatus';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { liveQueryOptions } from '@/lib/syncConfig';

// Filter list only — the *change* control offers just the legal next states
// for the row's current status (see adminStatusActions).
const ORDER_STATUSES = ['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned'];

/** A status change waiting on the operator to confirm its consequence. */
interface PendingChange {
  id: string;
  orderId: string;
  action: StatusAction;
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  // Server-driven sort — initial value matches the backend default (-createdAt)
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [refund, setRefund] = useState<{ id: string; orderId: string } | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  // Backend sort syntax: 'field' ascending, '-field' descending
  const sortParam = `${sort.direction === 'desc' ? '-' : ''}${sort.key}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter, sortParam],
    queryFn: () => api.get(`/admin/orders?page=${page}&limit=15&sort=${sortParam}${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  // Desktop headers toggle; the mobile select names the direction outright.
  const handleSort = (key: string, direction?: 'asc' | 'desc') => {
    setSort((prev) => ({
      key,
      direction: direction ?? (prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'),
    }));
    setPage(1);
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; label: string; orderId: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      showToast(`${variables.orderId} — ${variables.label.toLowerCase()}`, 'success');
      setUpdatingId(null);
      setPending(null);
    },
    onError: (err: unknown) => {
      setUpdatingId(null);
      setPending(null);
      showToast(getApiError(err), 'error');
    },
  });

  const applyChange = (change: PendingChange) => {
    setUpdatingId(change.id);
    updateStatus.mutate({ id: change.id, status: change.action.status, label: change.action.label, orderId: change.orderId });
  };

  const refundMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/orders/${id}/refund`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      showToast(res.data?.message || 'Refund sent to Razorpay', 'success');
      setRefund(null);
    },
    onError: (err: unknown) => {
      setRefund(null);
      showToast(getApiError(err), 'error');
    },
  });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'orderId', header: 'Order ID', render: (r) => <span className="font-mono text-xs text-violet-400">{r.orderId as string}</span>, sortable: true },
    { key: 'customer', header: 'Customer', render: (r) => <span>{(r.customer as { name?: string })?.name || 'Account removed'}</span> },
    {
      // Payment is a separate fact from fulfillment: a delivered order can be
      // refunded, and an online order can sit unpaid. Showing both stops
      // "delivered" from being read as "paid".
      key: 'paymentStatus',
      header: 'Payment',
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge status={(r.paymentStatus as string) || 'pending'} />
          <p className="text-xs uppercase tracking-wider text-muted">{r.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'}</p>
        </div>
      ),
    },
    { key: 'total', header: 'Amount', render: (r) => <span className="font-mono text-sm font-medium text-acid-400">{formatPrice(r.total as number)}</span>, sortable: true },
    { key: 'orderStatus', header: 'Fulfillment', render: (r) => <StatusBadge status={r.orderStatus as string} /> },
    { key: 'createdAt', header: 'Placed', render: (r) => <span className="text-muted text-xs">{formatDate(r.createdAt as string)}</span>, sortable: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-white">Orders</h1>
          <p className="text-muted text-sm mt-1">
            {isError ? 'Order data could not be loaded.' : `${data?.meta?.total ?? 0} total orders`}
          </p>
        </div>
        <div className="relative">
           <label htmlFor="admin-order-status-filter" className="sr-only">Filter orders by status</label>
           <select id="admin-order-status-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
             className="input min-h-11 text-sm py-2 pr-8 appearance-none cursor-pointer">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data as Record<string, unknown>[]) || []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        errorMessage="Orders could not be loaded. Check your connection and try again."
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        onPageChange={setPage}
        emptyMessage={statusFilter ? 'No orders with this status.' : 'No orders yet.'}
        rowIdKey="_id"
        sort={sort}
        onSortChange={handleSort}
        expandLabel="order details"
        rowLabelKey="orderId"
        expandableRender={(row) => {
          const items = (row.items as Array<Record<string, unknown>>) || [];
          const address = (row.shippingAddress as Record<string, string>) || {};
          const orderId = row.orderId as string;
          return (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm text-white">{(row.customer as { name?: string })?.name || 'Account removed'}</p>
                <p className="text-xs text-muted">{(row.customer as { email?: string })?.email}</p>
              </div>

              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-1.5">
                  {items.length === 0 && <p className="text-xs text-muted">No item data on this order.</p>}
                  {items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate text-white/70">
                        {(item.product as { name?: string })?.name || 'Product removed from catalog'}
                        <span className="text-muted text-xs"> × {String(item.quantity ?? 1)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-white/70">{formatPrice((item.totalPrice as number) ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 text-xs text-muted">
                <p className="font-semibold uppercase tracking-wider mb-1">Shipping to</p>
                <p>{[address.fullName, address.phone].filter(Boolean).join(' • ') || 'No address on file'}</p>
                <p>{[address.addressLine1, address.addressLine2, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Order total</p>
                  <p className="font-mono text-sm font-semibold text-acid-400">{formatPrice((row.total as number) ?? 0)}</p>
                </div>
                {row.paymentMethod === 'online' && row.paymentStatus === 'paid' && (
                  <button
                    type="button"
                    onClick={() => setRefund({ id: row._id as string, orderId })}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-500/30 px-3 text-xs text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                  >
                    <RotateCcw size={12} aria-hidden /> Refund payment
                  </button>
                )}
              </div>
            </div>
          );
        }}
        actions={(row) => {
          const id = row._id as string;
          const orderId = row.orderId as string;
          const options = adminStatusActions(row.orderStatus as string);
          const busy = updatingId === id;
          return (
            <div className="flex items-center gap-2">
              {options.length === 0 ? (
                <span className="text-xs text-muted">Closed</span>
              ) : (
                <div className="relative">
                  <label htmlFor={`next-status-${id}`} className="sr-only">Next status for order {orderId}</label>
                  <select
                    id={`next-status-${id}`}
                    // Always resets to the prompt: this is an action menu, not
                    // a mirror of current state (that is the Fulfillment cell).
                    value=""
                    onChange={(event) => {
                      const action = options.find((option) => option.status === event.target.value);
                      if (!action) return;
                      // Stock/money changes stop for confirmation; ordinary
                      // forward steps apply straight away.
                      if (action.confirm) setPending({ id, orderId, action });
                      else applyChange({ id, orderId, action });
                    }}
                    disabled={busy}
                    className="min-h-11 cursor-pointer appearance-none rounded-lg border border-white/15 bg-space-800 px-2.5 py-1.5 pr-7 text-xs text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-60"
                  >
                    <option value="">{busy ? 'Updating…' : 'Change status…'}</option>
                    {options.map((option) => (
                      <option key={option.status} value={option.status}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              )}
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={!!pending}
        title={pending ? `${pending.action.label} — ${pending.orderId}` : ''}
        description={pending?.action.confirm ?? ''}
        confirmLabel={pending?.action.label ?? 'Confirm'}
        isLoading={!!updatingId}
        onConfirm={() => pending && applyChange(pending)}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={!!refund}
        title={refund ? `Refund ${refund.orderId}` : ''}
        description="This sends a full refund for this order through Razorpay and marks the payment refunded. The order's fulfillment status does not change. It cannot be undone."
        confirmLabel="Refund payment"
        isLoading={refundMutation.isPending}
        onConfirm={() => refund && refundMutation.mutate(refund.id)}
        onCancel={() => setRefund(null)}
      />
    </div>
  );
}
