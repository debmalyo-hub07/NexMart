'use client';

import { StatusBadge } from '@/components/common/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Package, MapPin, CreditCard } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Order } from '@/types';
import { Skeleton } from '@/components/common/SkeletonLoader';
import { useSocket } from '@/hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SOCKET_EVENTS } from '@/lib/socketEvents';
import { useUIStore } from '@/store/uiStore';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const { showToast } = useUIStore();

  const { data, isLoading } = useQuery<{ data: Order }>({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
  });

  // Human order id (NXM-...) from the query cache, kept in a ref so the
  // listener registration doesn't depend on the query data.
  const orderIdRef = useRef<string | null>(null);
  useEffect(() => {
    orderIdRef.current = data?.data?.orderId ?? null;
  }, [data]);

  useEffect(() => {
    const unsubscribe = on<{ orderId: string; status: string }>(SOCKET_EVENTS.orderStatusUpdated, (payload) => {
      if (orderIdRef.current && payload.orderId === orderIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
      }
    });
    return unsubscribe;
  }, [on, id, queryClient]);

  const order = data?.data;

  const handleDownloadInvoice = async () => {
    if (!order) return;
    try {
      const { data: inv } = await api.get(`/orders/${id}/invoice`);
      if (inv.data?.invoiceUrl) window.open(inv.data.invoiceUrl, '_blank');
      else showToast(inv.message || 'Invoice is being generated, please try again shortly.', 'info');
    } catch (err: unknown) {
      showToast(getApiError(err), 'error');
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px] page-container py-12 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center">      <div className="text-center">
        <Package size={48} className="text-white/10 mx-auto mb-4" />
        <h2 className="font-syne text-2xl font-bold text-white mb-3">Order not found</h2>
        <Link href="/orders" className="btn-primary inline-flex">← Back to Orders</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        <div className="page-container py-12 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 glass rounded-xl text-white/50 hover:text-white transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="font-syne text-2xl font-bold text-white">Order #{order.orderId}</h1>
                <p className="text-sm text-white/40">{formatDate(order.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.orderStatus} />
              {(order.orderStatus === 'delivered' || order.invoiceUrl) && (
                <button onClick={handleDownloadInvoice} className="btn-secondary text-sm flex items-center gap-2">
                  <Download size={14} /> Invoice
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass rounded-2xl p-6 border border-white/5">
                <h3 className="font-syne font-semibold text-white mb-4 flex items-center gap-2">
                  <Package size={16} className="text-violet-400" /> Items Ordered
                </h3>
                <div className="space-y-4 divide-y divide-white/5">
                  {order.items.map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 pt-4 first:pt-0">
                      {(item.product as { images?: string[] })?.images?.[0] && (
                        <Image src={(item.product as { images: string[] }).images[0]} alt=""
                          width={60} height={60} className="rounded-xl object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{(item.product as { name: string }).name}</p>
                        <p className="text-xs text-white/40">SKU: {item.variant} · Qty: {item.quantity}</p>
                        <p className="text-xs text-white/50 mt-0.5">{formatPrice(item.unitPrice)} each</p>
                      </div>
                      <p className="text-sm font-semibold text-acid-400">{formatPrice(item.totalPrice)}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="glass rounded-2xl p-6 border border-white/5">
                <h3 className="font-syne font-semibold text-white mb-5">Order Timeline</h3>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
                  {order.statusHistory.slice().reverse().map((h, i) => (
                    <div key={i} className="relative mb-5 last:mb-0">
                      <div className={`absolute -left-4 w-4 h-4 rounded-full border-2 ${i === 0 ? 'bg-violet-500 border-violet-500 shadow-glow-violet' : 'bg-space-800 border-white/20'}`} />
                      <div className="flex items-center gap-3 mb-0.5">
                        <StatusBadge status={h.status} />
                        <span className="text-xs text-white/40">{formatDate(h.timestamp, { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}</span>
                      </div>
                      {h.note && <p className="text-xs text-white/40 mt-1 ml-1">{h.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="space-y-4">
              {/* Price breakdown */}
              <div className="glass rounded-2xl p-5 border border-white/5">
                <h3 className="font-syne font-semibold text-white mb-4 flex items-center gap-2">
                  <CreditCard size={15} className="text-violet-400" /> Payment
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                  <div className="flex justify-between text-white/60"><span>Shipping</span><span className={order.shippingFee === 0 ? 'text-acid-400' : ''}>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</span></div>
                  <div className="flex justify-between text-white/60"><span>Tax (GST)</span><span>{formatPrice(order.tax)}</span></div>
                  {order.discount > 0 && <div className="flex justify-between text-acid-400"><span>Discount</span><span>-{formatPrice(order.discount)}</span></div>}
                  <div className="flex justify-between font-syne font-bold text-white border-t border-white/10 pt-2.5">
                    <span>Total</span><span className="text-acid-400">{formatPrice(order.total)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs text-white/40">Payment method: <span className="text-white/70 capitalize">{order.paymentMethod}</span></p>
                  <p className="text-xs text-white/40 mt-1">Status: <span className={order.paymentStatus === 'paid' ? 'text-acid-400' : 'text-amber-400'}>{order.paymentStatus}</span></p>
                </div>
              </div>

              {/* Shipping address */}
              <div className="glass rounded-2xl p-5 border border-white/5">
                <h3 className="font-syne font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin size={15} className="text-violet-400" /> Delivery Address
                </h3>
                <div className="text-sm text-white/60 space-y-1">
                  <p className="font-medium text-white">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.phone}</p>
                  <p>{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>    </div>
  );
}
