'use client';

import { memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { LineChart, RotateCw } from 'lucide-react';

interface DataPoint { date: string; revenue: number; orders: number; }
interface RevenueChartProps {
  data: DataPoint[];
  /** True while the parent query is fetching and no data is cached yet. */
  isLoading?: boolean;
  /** True when the parent query failed and there is no cached data to show. */
  isError?: boolean;
  /** Invoked by the "Retry" button shown in the error state. */
  onRetry?: () => void;
}

const CustomTooltip = memo(function CustomTooltip({
  active, payload, label,
}: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/[0.08] text-sm">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold text-white">
          {p.name === 'revenue' ? '₹' : ''}
          {p.value.toLocaleString('en-IN')}
          <span className="text-white/40 font-normal ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  );
});

// Gradient IDs are stable strings — no recreation risk
const CHART_MARGINS = { top: 5, right: 5, left: 0, bottom: 5 };
const X_TICK = { fill: 'rgba(255,255,255,0.4)', fontSize: 11 };
const Y_TICK = { fill: 'rgba(255,255,255,0.4)', fontSize: 11 };

export const RevenueChart = memo(function RevenueChart({
  data, isLoading, isError, onRetry,
}: RevenueChartProps) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      <h3 className="font-syne font-semibold text-white mb-6">Revenue Overview</h3>
      {isLoading ? (
        <div className="w-full h-[260px] rounded-xl skeleton" aria-hidden="true" />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 h-[260px] text-center">
          <LineChart size={28} className="text-white/20" aria-hidden="true" />
          <p className="text-sm text-white/40">Failed to load revenue data</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              <RotateCw size={12} aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-[260px] text-center">
          <LineChart size={28} className="text-white/20" aria-hidden="true" />
          <p className="text-sm text-white/40">No revenue data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={CHART_MARGINS}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22D58D" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22D58D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={X_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={Y_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#revGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="orders" stroke="#22D58D" strokeWidth={2} fill="url(#ordGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
