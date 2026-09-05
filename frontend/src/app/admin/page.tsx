'use client';

import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import api from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ClockCalendar } from '@/components/common/ClockCalendar';
import { DashboardStats } from '@/types';
import { ShoppingBag, Users, TrendingUp, Clock } from 'lucide-react';
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
    render: (r) => <span>{(r.customer as { name: string })?.name}</span>,
  },
  {
    key: 'total',
    header: 'Amount',
    render: (r) => <span className="text-acid-400 font-medium">{formatPrice(r.total as number)}</span>,
  },
  {
    key: 'orderStatus',
    header: 'Status',
    render: (r) => <StatusBadge status={r.orderStatus as string} />,
  },
  {
    key: 'createdAt',
    header: 'Date',
    render: (r) => <span className="text-white/50">{formatDate(r.createdAt as string)}</span>,
  },
];

const TopProductRow = memo(function TopProductRow({
  product, index,
}: { product: { name: string; totalSold: number; revenue: number }; index: number }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40">{product.totalSold} sold</p>
      </div>
      <p className="text-sm font-medium text-acid-400 shrink-0">{formatPrice(product.revenue)}</p>
    </div>
  );
});

// Skeleton rows for the Top Products panel while analytics loads
const TOP_PRODUCT_SKELETONS = Array.from({ length: 5 }, (_, i) => i);

export default function AdminDashboard() {
  // Phase 8 — Auto-sync every 20 seconds (lightweight polling, no UI freeze)
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
    queryFn: () => api.get('/admin/analytics?days=30').then((r) => r.data.data as any),
    ...analyticsQueryOptions,
  });

  // A query only counts as failed when there is no cached data to fall back on —
  // a failed background refresh keeps showing the last real values.
  const statsFailed = statsError && !statsData;
  const analyticsFailed = analyticsError && !analyticsData;

  const chartData = analyticsData?.dailyRevenue?.map(
    (d: { _id: string; revenue: number; orders: number }) => ({
      date: d._id,
      revenue: d.revenue,
      orders: d.orders,
    }),
  ) ?? [];

  const topProducts: { name: string; totalSold: number; revenue: number }[] =
    (analyticsData?.topProducts ?? []).slice(0, 5);

  const recentOrders = (statsData?.recentOrders as unknown as Record<string, unknown>[]) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Clock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col justify-center">
          <h1 className="font-syne text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-base mt-2 leading-relaxed">
            Welcome back to the Admin control center. Here's a real-time overview of your store's performance.
          </p>
        </div>
        <div className="flex justify-end">
          <div className="w-full max-w-[650px]">
            <ClockCalendar />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Total Revenue"
          value={statsData?.totalRevenue}
          prefix="₹"
          icon={TrendingUp}
          color="violet"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Total Orders"
          value={statsData?.totalOrders}
          icon={ShoppingBag}
          color="acid"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Customers"
          value={statsData?.totalUsers}
          icon={Users}
          color="amber"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
        <StatsCard
          title="Pending Orders"
          value={statsData?.pendingOrders}
          icon={Clock}
          color="red"
          isLoading={statsLoading}
          isError={statsFailed}
          onRetry={() => refetchStats()}
        />
      </div>

      {/* Chart */}
      <RevenueChart
        data={chartData}
        isLoading={analyticsLoading}
        isError={analyticsFailed}
        onRetry={() => refetchAnalytics()}
      />

      {/* Recent Orders + Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="xl:col-span-2">
          <h3 className="font-syne font-semibold text-white mb-4">Recent Orders</h3>
          <DataTable
            columns={recentOrderCols}
            data={recentOrders}
            isLoading={statsLoading}
            emptyMessage={statsFailed ? 'Failed to load orders — try Retry above' : 'No orders yet'}
          />
        </div>

        {/* Top Products */}
        <div>
          <h3 className="font-syne font-semibold text-white mb-4">Top Products</h3>
          <div className="glass rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            {analyticsLoading ? (
              TOP_PRODUCT_SKELETONS.map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-7 h-7 rounded-lg skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded skeleton" />
                    <div className="h-3 w-1/3 rounded skeleton" />
                  </div>
                  <div className="h-3.5 w-14 rounded skeleton shrink-0" />
                </div>
              ))
            ) : analyticsFailed ? (
              <p className="text-center text-sm text-white/30 py-8">Failed to load top products</p>
            ) : topProducts.length > 0 ? (
              topProducts.map((p, i) => (
                <TopProductRow key={i} product={p} index={i} />
              ))
            ) : (
              <p className="text-center text-sm text-white/30 py-8">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
