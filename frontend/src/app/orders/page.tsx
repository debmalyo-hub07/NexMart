'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Package, ChevronDown, ChevronUp, Download } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Order } from '@/types';
import { OrderRowSkeleton } from '@/components/common/SkeletonLoader';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS } from '@/lib/socketEvents';
import { useUIStore } from '@/store/uiStore';
import { Pagination } from '@/components/common/Pagination';
import { QueryError } from '@/components/common/QueryError';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const { showToast } = useUIStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api.get(`/orders?page=${page}&limit=10`).then((r) => r.data),
  });

  const orders: Order[] = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  // Real-time order status updates (backend emits order:status_updated)
  useEffect(() => {
    const unsubscribe = on<{ orderId: string; status: string }>(SOCKET_EVENTS.orderStatusUpdated, () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });
    return unsubscribe;
  }, [on, queryClient]);

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const { data } = await api.get(`/orders/${orderId}/invoice`);
      if (data.data?.invoiceUrl) {
        window.open(data.data.invoiceUrl, '_blank');
      } else {
        showToast(data.message || 'Invoice is being generated. Please try again in a moment.', 'info');
      }
    } catch (err: unknown) {
      showToast(getApiError(err), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        <div className="page-container py-12">
          <h1 className="font-syne text-3xl font-bold text-white mb-8 flex items-center gap-3">
            <Package size={28} className="text-violet-400" /> My Orders
          </h1>

          {isLoading ? (
            <div className="glass rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
              {Array(5).fill(0).map((_, i) => <OrderRowSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <QueryError label="Your orders" onRetry={() => void refetch()} />
          ) : orders.length === 0 ? (
            <div className="text-center py-32">
              <div className="w-24 h-24 rounded-3xl glass flex items-center justify-center mx-auto mb-6">
                <Package size={40} className="text-white/20" />
              </div>
              <h2 className="font-syne text-2xl font-bold text-white mb-3">No orders yet</h2>
              <p className="text-white/40 mb-8">Your order history will appear here</p>
              <Link href="/products" className="btn-primary inline-flex">Start Shopping</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <article key={order._id} className="glass rounded-2xl border border-white/5 overflow-hidden">
                  {/* Order header */}
                  <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-white/40 mb-1">Order ID</p>
                        <p className="break-all text-sm font-mono font-medium text-white">{order.orderId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40 mb-1">Date</p>
                        <p className="text-sm text-white">{formatDate(order.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40 mb-1">Total</p>
                        <p className="text-sm font-semibold text-acid-400">{formatPrice(order.total)}</p>
                      </div>
                      <div>
                        <StatusBadge status={order.orderStatus} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                        aria-expanded={expanded === order._id}
                        aria-controls={`order-details-${order._id}`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                      >
                        {expanded === order._id ? 'Hide details' : 'View details'}
                        {expanded === order._id ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownloadInvoice(order._id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/60 transition-colors hover:border-violet-500/40 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                      >
                        <Download size={16} aria-hidden /> Download invoice
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                    {expanded === order._id && (
                      <div id={`order-details-${order._id}`} className="border-t border-white/5">
                        <div className="p-5 space-y-4">
                          {/* Items */}
                          <div className="space-y-3">
                            {order.items.map((item, j) => (
                              <div key={j} className="flex items-center gap-3">
                                {(item.product as { images?: string[] })?.images?.[0] && (
                                  <Image src={(item.product as { images: string[] }).images[0]} alt=""
                                    width={48} height={48} className="rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{(item.product as { name: string }).name}</p>
                                  <p className="text-xs text-white/40">Qty: {item.quantity} × {formatPrice(item.unitPrice)}</p>
                                </div>
                                <p className="text-sm font-medium text-white">{formatPrice(item.totalPrice)}</p>
                              </div>
                            ))}
                          </div>

                          {/* Status timeline */}
                          <div className="border-t border-white/5 pt-4">
                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Status History</p>
                            <div className="space-y-2">
                              {order.statusHistory.slice().reverse().map((h, k) => (
                                <div key={k} className="flex items-center gap-3 text-xs">
                                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                  <StatusBadge status={h.status} />
                                  <span className="text-white/40">{formatDate(h.timestamp, { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Shipping address */}
                          <div className="border-t border-white/5 pt-4 text-xs text-white/50">
                            <p className="font-medium text-white/70 mb-1">Shipping to:</p>
                            <p>{order.shippingAddress.fullName} • {order.shippingAddress.phone}</p>
                            <p>{order.shippingAddress.addressLine1}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
                          </div>
                        </div>
                      </div>
                    )}
                </article>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
              )}
            </div>
          )}
        </div>
      </div>    </div>
  );
}
