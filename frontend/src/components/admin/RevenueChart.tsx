'use client';

import { memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint { date: string; revenue: number; orders: number; }
interface RevenueChartProps { data: DataPoint[]; }

const CustomTooltip = memo(function CustomTooltip({
  active, payload, label,
}: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/8 text-sm">
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

export const RevenueChart = memo(function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      <h3 className="font-syne font-semibold text-white mb-6">Revenue Overview</h3>
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
    </div>
  );
});
