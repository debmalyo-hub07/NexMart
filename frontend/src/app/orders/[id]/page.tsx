'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MapPin, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import type { ApiResponse, Order } from '@/types';
import { formatDate } from '@/lib/utils';
import { orderQueryOptions } from '@/lib/syncConfig';
import { useOrderUpdates } from '@/hooks/useOrderUpdates';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/SkeletonLoader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { OrderTotals } from '@/components/cart/OrderTotals';
import { OrderItems } from '@/components/orders/OrderItems';
import { PaymentPanel } from '@/components/orders/PaymentPanel';
import { InvoiceButton } from '@/components/orders/InvoiceButton';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  useOrderUpdates();
  const query = useQuery({ queryKey: ['customer', 'orders', 'detail', id], queryFn: ({ signal }) => api.get<ApiResponse<Order>>(`/orders/${id}`, { signal }).then(r => r.data.data), ...orderQueryOptions });
  const order = query.data;
  return <main id="main-content" className="store-page"><div className="page-container">
    <Link href="/orders" className="mb-4 inline-flex min-h-11 items-center text-sm text-secondary underline">Back to orders</Link>
    {query.isPending ? <div className="space-y-5"><Skeleton className="h-12 w-60" /><Skeleton className="h-80 rounded-2xl" /></div> : <>
      {query.isError && <div className="mb-5"><QueryError label="Order details" detail={order ? 'These are the last saved details. Refresh to check the latest payment and delivery status.' : undefined} onRetry={() => void query.refetch()} /></div>}
      {!order ? !query.isError && <EmptyState title="Order not found" description="This order is unavailable for your account." action={<Link href="/orders" className="btn-primary">Your orders</Link>} /> : <>
        <PageHeader title={`Order ${order.orderId}`} description={`Placed ${formatDate(order.createdAt)}. Payment and fulfillment are tracked separately.`} actions={<button type="button" className="btn-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={17} aria-hidden />Refresh</button>} />
        <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-4"><div><dt className="mb-2 text-sm text-muted">Fulfillment</dt><dd><StatusBadge status={order.orderStatus} /></dd></div><div><dt className="mb-2 text-sm text-muted">Payment</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div><div><dt className="mb-2 text-sm text-muted">Method</dt><dd className="text-sm">{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</dd></div></dl>
        {['cancelled', 'returned'].includes(order.orderStatus) && order.paymentStatus === 'paid' && <p role="status" className="mb-6 rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">This order is {order.orderStatus}. Payment was received; a refund has not been recorded.</p>}
        {order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && !['cancelled', 'returned'].includes(order.orderStatus) && <p className="mb-6 text-sm text-secondary">Payment is due on delivery. A placed order awaits store confirmation.</p>}
        <div className="mb-6">{!query.isError && <PaymentPanel order={order} />}</div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="min-w-0 space-y-6">
          <section className="card"><h2 className="mb-5 text-xl">Items ordered</h2><OrderItems items={order.items} /></section>
          <section className="card"><h2 className="mb-5 text-xl">Order timeline</h2><ol className="space-y-5 border-l border-white/20 pl-4">{order.statusHistory.map((entry, index) => <li key={`${entry.timestamp}-${index}`}><div className="flex flex-wrap items-center gap-3"><StatusBadge status={entry.status} /><time dateTime={entry.timestamp} className="text-xs text-muted">{formatDate(entry.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>{entry.note && <p className="mt-2 break-words text-sm text-secondary">{entry.note}</p>}</li>)}</ol><p className="mt-5 text-xs text-muted">Updates refresh automatically while this page is open.</p></section>
        </div><aside className="min-w-0 space-y-6"><section className="card"><h2 className="mb-5 text-xl">Order total</h2><OrderTotals totals={order} />{(order.invoiceUrl || order.paymentStatus === 'paid' || order.orderStatus === 'delivered') && <div className="mt-5"><InvoiceButton orderId={order._id} invoiceUrl={order.invoiceUrl} /></div>}</section>
          <section className="card"><h2 className="mb-4 flex items-center gap-2 text-xl"><MapPin size={20} aria-hidden />Delivery address</h2><address className="space-y-1 break-words text-sm not-italic text-secondary"><p className="font-medium text-white">{order.shippingAddress.fullName}</p><p>{order.shippingAddress.phone}</p><p>{order.shippingAddress.addressLine1}</p>{order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}<p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p></address>{order.deliveryAgent && <p className="mt-4 text-sm text-secondary">Assigned to {order.deliveryAgent.name}</p>}</section>
        </aside></div>
      </>}
    </>}
  </div></main>;
}
