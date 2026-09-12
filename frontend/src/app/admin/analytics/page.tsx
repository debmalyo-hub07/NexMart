'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatPrice } from '@/lib/utils';
import { BarChart3, TrendingUp, ShoppingBag, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyticsQueryOptions } from '@/lib/syncConfig';
import type { AnalyticsSummary } from '@/types';

const COLORS = ['#7C3AED', '#22D58D', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api.get(`/admin/analytics?days=${days}`).then((r) => r.data.data as AnalyticsSummary),
    ...analyticsQueryOptions,
  });

  // Only treat the query as failed when there is no cached data to fall back on.
  const analyticsFailed = isError && !data;

  const chartData = (data?.dailyRevenue || []).map((d) => ({
    date: d._id?.slice(5),
    revenue: d.revenue,
    orders: d.orders,
  }));

  const statusData = (data?.ordersByStatus || []).map((d) => ({
    name: d._id?.replace(/_/g, ' '),
    count: d.count,
  }));

  const topProducts = data?.topProducts || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-white">Analytics</h1>
          <p className="text-secondary text-sm mt-1">Paid revenue, order mix and best sellers over the selected window.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reporting window">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 ${days === d ? 'bg-violet-600 text-white shadow-glow-violet' : 'glass border border-white/10 text-secondary hover:text-white'}`}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <RevenueChart
        title={`Paid revenue, last ${days} days`}
        description="Counts orders whose payment has been received. Unpaid and cancelled orders are excluded."
        data={chartData}
        isLoading={isLoading}
        isError={analyticsFailed}
        onRetry={() => refetch()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="font-outfit font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-violet-400" /> Orders by Status
          </h3>
          {isLoading ? (
            <div className="w-full h-[220px] rounded-xl skeleton" aria-hidden="true" />
          ) : analyticsFailed ? (
            <div className="flex flex-col items-center justify-center gap-2 h-[220px] text-center">
              <BarChart3 size={28} className="text-white/20" aria-hidden="true" />
              <p className="text-sm text-muted">Failed to load order status data</p>
            </div>
          ) : statusData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 h-[220px] text-center">
              <BarChart3 size={28} className="text-white/20" aria-hidden="true" />
              <p className="text-sm text-muted">No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {statusData.map((_: unknown, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="font-outfit font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-acid-400" /> Top Selling Products
          </h3>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-4 h-3 rounded skeleton shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-3 w-2/3 rounded skeleton" />
                    <div className="h-1.5 w-full rounded-full skeleton" />
                  </div>
                  <div className="w-6 h-3 rounded skeleton shrink-0" />
                </div>
              ))
            ) : analyticsFailed ? (
              <p className="text-sm text-muted text-center py-8">Failed to load product data</p>
            ) : (
              <>
                {topProducts.slice(0, 7).map((p: { name: string; totalSold: number; revenue: number }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <p className="text-xs text-white truncate">{p.name}</p>
                        <p className="text-xs text-acid-400 font-medium shrink-0 ml-2">{formatPrice(p.revenue)}</p>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min((p.totalSold / (topProducts[0]?.totalSold || 1)) * 100, 100)}%` }}
                          className="h-full rounded-full bg-violet-gradient"
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted shrink-0">{p.totalSold}</span>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-sm text-muted text-center py-8">No sales data yet</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
