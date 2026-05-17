'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Order } from '@/types';
import { OrderRowSkeleton } from '@/components/common/SkeletonLoader';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api.get(`/orders?page=${page}&limit=10`).then((r) => r.data),
  });

  const orders: Order[] = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  // Real-time order status updates
  useEffect(() => {
    on<{ orderId: string; status: string }>('order:status_update', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });
    // socket.io listener cleanup is handled by the hook
  }, [on, queryClient]);

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const { data } = await api.get(`/orders/${orderId}/invoice`);
      if (data.data?.invoiceUrl) {
        window.open(data.data.invoiceUrl, '_blank');
      } else {
        alert('Invoice is being generated. Please try again in a moment.');
      }
    } catch {
      alert('Failed to download invoice');
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
              {orders.map((order, i) => (
                <motion.div key={order._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl border border-white/5 overflow-hidden">
                  {/* Order header */}
                  <button onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                    className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-white/40 mb-1">Order ID</p>
                        <p className="text-sm font-mono font-medium text-white">{order.orderId}</p>
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
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(order._id); }}
                        className="p-2 rounded-lg glass text-white/40 hover:text-violet-400 transition-colors" title="Download Invoice">
                        <Download size={14} />
                      </button>
                      {expanded === order._id ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expanded === order._id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden border-t border-white/5">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-violet-600 text-white shadow-glow-violet' : 'glass text-white/50 hover:text-white'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>    </div>
  );
}
