'use client';

import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { QueryError } from '@/components/common/QueryError';
import { ClockCalendar } from '@/components/common/ClockCalendar';
import { AnalyticsSummary, DashboardStats } from '@/types';
import { ShoppingBag, Users, IndianRupee, Clock } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { liveQueryOptions, analyticsQueryOptions } from '@/lib/syncConfig';

// Stable column definitions — defined outside component to prevent recreation
const recentOrderCols: Column<Record<string, unknown>>[] = [
  {
    key: 'orderId',
    header: 'Order ID',
    render: (r) => <span className="font-mono text-xs text-violet-400">{r.orderId as string}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (r) => <span>{(r.customer as { name?: string })?.name || 'Account removed'}</span>,
  },
  {
    key: 'total',
    header: 'Amount',
    render: (r) => <span className="font-mono text-sm font-medium text-acid-400">{formatPrice(r.total as number)}</span>,
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    render: (r) => <StatusBadge status={(r.paymentStatus as string) || 'pending'} />,
  },
  {
    key: 'orderStatus',
    header: 'Fulfillment',
    render: (r) => <StatusBadge status={r.orderStatus as string} />,
  },
  {
    key: 'createdAt',
    header: 'Placed',
    render: (r) => <span className="text-muted text-xs">{formatDate(r.createdAt as string)}</span>,
  },
];

const TopProductRow = memo(function TopProductRow({
  product, index,
}: { product: { name: string; slug?: string; totalSold: number; revenue: number }; index: number }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-300"
        aria-label={`Rank ${index + 1}`}
      >
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        {product.slug ? (
          <Link href={`/products/${product.slug}`} className="block truncate text-sm text-white hover:text-violet-300">
            {product.name}
          </Link>
        ) : (
          <p className="truncate text-sm text-white">{product.name}</p>
        )}
        <p className="text-xs text-muted">{product.totalSold} sold</p>
      </div>
      <p className="shrink-0 font-mono text-sm font-medium text-acid-400">{formatPrice(product.revenue)}</p>
    </div>
  );
});

// Skeleton rows for the Top Products panel while analytics loads
const TOP_PRODUCT_SKELETONS = Array.from({ length: 5 }, (_, i) => i);

export default function AdminDashboard() {
  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/dashboard/stats').then((r) => r.data.data as DashboardStats),
    ...liveQueryOptions,
  });

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api.get('/admin/analytics?days=30').then((r) => r.data.data as AnalyticsSummary),
    ...analyticsQueryOptions,
  });

  // A query only counts as failed when there is no cached data to fall back on —
  // a failed background refresh keeps showing the last real values.
  const statsFailed = statsError && !statsData;
  const analyticsFailed = analyticsError && !analyticsData;

  const chartData = analyticsData?.dailyRevenue?.map((d) => ({
    date: d._id,
    revenue: d.revenue,
    orders: d.orders,
  })) ?? [];

  const topProducts = (analyticsData?.topProducts ?? []).slice(0, 5);

  const recentOrders = (statsData?.recentOrders as unknown as Record<string, unknown>[]) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="font-outfit text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-base leading-relaxed text-secondary">
          Store activity, refreshed automatically while this tab is open.
        </p>
      </div>

      {/* Work first: the tile that needs action leads, and each tile states
          the scope of its number so it is not misread against Analytics. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Awaiting fulfillment"
          value={statsData?.pendingOrders}
          icon={Clock}
          color="amber"
          hint="Orders placed, confirmed or processing."
          href="/admin/orders"
          hrefLabel="Work the queue"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Total orders"
          value={statsData?.totalOrders}
          icon={ShoppingBag}
          color="violet"
          hint="Every order ever placed, all statuses."
          href="/admin/orders"
          hrefLabel="View orders"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Order value, all orders"
          value={statsData?.totalRevenue}
          prefix="₹"
          icon={IndianRupee}
          color="acid"
          hint="Sum of every order total, whether paid, unpaid or cancelled. Paid revenue is in Analytics."
          href="/admin/analytics"
          hrefLabel="See paid revenue"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Customers"
          value={statsData?.totalUsers}
          icon={Users}
          color="violet"
          hint="Registered customer accounts."
          href="/admin/users"
          hrefLabel="Manage customers"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
      </div>

      <RevenueChart
        title="Paid revenue, last 30 days"
        description="Counts orders whose payment has been received. Unpaid and cancelled orders are excluded."
        data={chartData}
        isLoading={analyticsLoading}
        isError={analyticsFailed}
        onRetry={() => refetchAnalytics()}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-outfit font-semibold text-white">Latest orders</h2>
            <Link href="/admin/orders" className="text-sm text-violet-300 hover:text-violet-200">All orders</Link>
          </div>
          <DataTable
            columns={recentOrderCols}
            data={recentOrders}
            isLoading={statsLoading}
            isError={statsFailed}
            onRetry={() => void refetchStats()}
            errorMessage="The latest orders could not be loaded. Check your connection and try again."
            emptyMessage="No orders yet."
          />
        </div>

        <div>
          <h2 className="font-outfit font-semibold text-white">Best selling, last 30 days</h2>
          <p className="mb-4 mt-1 text-sm text-muted">By item value across all orders in the window.</p>
          <div className="glass divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {analyticsLoading ? (
              TOP_PRODUCT_SKELETONS.map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="skeleton h-7 w-7 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                  <div className="skeleton h-3.5 w-14 shrink-0 rounded" />
                </div>
              ))
            ) : analyticsFailed ? (
              <QueryError label="Best selling products" onRetry={() => void refetchAnalytics()} />
            ) : topProducts.length > 0 ? (
              topProducts.map((p, i) => <TopProductRow key={p.slug ?? p.name ?? i} product={p} index={i} />)
            ) : (
              <p className="py-8 text-center text-sm text-secondary">No orders in the last 30 days.</p>
            )}
          </div>
        </div>
      </div>

      {/* Reference utility, deliberately last — it is not the operator's work. */}
      <ClockCalendar />
    </div>
  );
}
