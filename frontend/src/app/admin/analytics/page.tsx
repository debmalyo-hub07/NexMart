'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatPrice } from '@/lib/utils';
import { BarChart3, TrendingUp, ShoppingBag, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyticsQueryOptions } from '@/lib/syncConfig';

const COLORS = ['#7C3AED', '#22D58D', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: () => api.get(`/admin/analytics?days=${days}`).then((r) => r.data.data),
    ...analyticsQueryOptions,
  });

  const chartData = (data?.dailyRevenue || []).map((d: { _id: string; revenue: number; orders: number }) => ({
    date: d._id?.slice(5),
    revenue: d.revenue,
    orders: d.orders,
  }));

  const statusData = (data?.ordersByStatus || []).map((d: { _id: string; count: number }) => ({
    name: d._id?.replace(/_/g, ' '),
    count: d.count,
  }));

  const topProducts = data?.topProducts || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-syne text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/50 text-sm mt-1">Business performance overview</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${days === d ? 'bg-violet-600 text-white shadow-glow-violet' : 'glass text-white/50 hover:text-white border border-white/10'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={chartData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="font-syne font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-violet-400" /> Orders by Status
          </h3>
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
        </div>

        {/* Top Products */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="font-syne font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-acid-400" /> Top Selling Products
          </h3>
          <div className="space-y-3">
            {topProducts.slice(0, 7).map((p: { name: string; totalSold: number; revenue: number }, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3">
                <span className="text-xs text-white/30 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-white truncate">{p.name}</p>
                    <p className="text-xs text-acid-400 font-medium shrink-0 ml-2">{formatPrice(p.revenue)}</p>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((p.totalSold / (topProducts[0]?.totalSold || 1)) * 100, 100)}%` }}
                      transition={{ delay: i * 0.05 + 0.3, duration: 0.8 }}
                      className="h-full bg-violet-gradient rounded-full"
                    />
                  </div>
                </div>
                <span className="text-xs text-white/50 shrink-0">{p.totalSold}</span>
              </motion.div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-white/30 text-center py-8">No sales data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
