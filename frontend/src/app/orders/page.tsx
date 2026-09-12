'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import type { ApiResponse, Order } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { orderQueryOptions } from '@/lib/syncConfig';
import { useOrderUpdates } from '@/hooks/useOrderUpdates';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { OrderRowSkeleton } from '@/components/common/SkeletonLoader';
import { OrderItems } from '@/components/orders/OrderItems';
import { InvoiceButton } from '@/components/orders/InvoiceButton';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  useOrderUpdates();
  const query = useQuery({ queryKey: ['customer', 'orders', 'list', page], queryFn: ({ signal }) => api.get<ApiResponse<Order[]>>('/orders', { params: { page, limit: 10 }, signal }).then(r => r.data), ...orderQueryOptions });
  return <main id="main-content" className="store-page"><div className="page-container">
    <PageHeader title="Your orders" description="Track deliveries, check payments, and find invoices." actions={<button type="button" className="btn-secondary" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={17} aria-hidden />Refresh</button>} />
    {query.isError && <div className="mb-5"><QueryError label="Your orders" detail={query.data ? 'The list below is the last update. Refresh before acting on an order.' : undefined} onRetry={() => void query.refetch()} /></div>}
    {query.isPending ? <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <OrderRowSkeleton key={index} />)}</div> : query.data?.data?.length ? <div className="space-y-5">{query.data.data.map(order => <article className="card" key={order._id}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/orders/${order._id}`} className="inline-flex min-h-11 items-center break-all font-mono text-sm font-semibold text-violet-200 underline">{order.orderId}</Link><p className="text-xs text-muted">Placed {formatDate(order.createdAt)}</p></div><p className="font-mono text-lg font-semibold">{formatPrice(order.total)}</p></div>
      <dl className="my-5 flex flex-wrap gap-x-8 gap-y-3"><div><dt className="mb-1 text-xs text-muted">Fulfillment</dt><dd><StatusBadge status={order.orderStatus} /></dd></div><div><dt className="mb-1 text-xs text-muted">Payment · {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'}</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div></dl>
      <OrderItems items={order.items} />
      <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-white/10 pt-4"><Link href={`/orders/${order._id}`} className="btn-primary">{order.paymentMethod === 'online' && order.orderStatus === 'placed' && ['pending', 'failed'].includes(order.paymentStatus) ? 'Payment & order details' : 'View order & tracking'}</Link>{(order.invoiceUrl || order.paymentStatus === 'paid' || order.orderStatus === 'delivered') && <InvoiceButton orderId={order._id} invoiceUrl={order.invoiceUrl} />}</div>
    </article>)}</div> : !query.isError && <EmptyState icon={Package} title="No orders yet" description="After you place an order, its payment and delivery details will appear here." action={<Link href="/products" className="btn-primary">Browse products</Link>} />}
    {(query.data?.meta?.totalPages ?? 0) > 1 && <div className="mt-6"><Pagination page={page} totalPages={query.data!.meta!.totalPages} onPageChange={setPage} /></div>}
  </div></main>;
}
