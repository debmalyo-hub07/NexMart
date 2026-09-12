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
  /** Heading rendered inside the card. Omit when the page supplies its own. */
  title?: string;
  /** One line stating what the series actually count. */
  description?: string;
}

const CustomTooltip = memo(function CustomTooltip({
  active, payload, label,
}: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/[0.08] text-sm">
      <p className="text-secondary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold text-white">
          {p.name === 'revenue' ? '₹' : ''}
          {p.value.toLocaleString('en-IN')}
          <span className="text-muted font-normal ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  );
});

// Gradient IDs are stable strings — no recreation risk
const CHART_MARGINS = { top: 5, right: 5, left: 0, bottom: 5 };
const X_TICK = { fill: 'rgba(255,255,255,0.65)', fontSize: 11 };
const Y_TICK = { fill: 'rgba(255,255,255,0.65)', fontSize: 11 };

export const RevenueChart = memo(function RevenueChart({
  data, isLoading, isError, onRetry, title, description,
}: RevenueChartProps) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      {(title || description) && (
        <div className="mb-6">
          {title && <h3 className="font-outfit font-semibold text-white">{title}</h3>}
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      )}
      {isLoading ? (
        <div className="w-full h-[260px] rounded-xl skeleton" aria-hidden="true" />
      ) : isError ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center" role="alert">
          <LineChart size={28} className="text-white/25" aria-hidden="true" />
          <p className="text-sm text-red-300">Revenue data could not be loaded.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary min-h-11"
            >
              <RotateCw size={14} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-[260px] text-center">
          <LineChart size={28} className="text-white/20" aria-hidden="true" />
          <p className="text-sm text-secondary">No paid orders in this period.</p>
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
