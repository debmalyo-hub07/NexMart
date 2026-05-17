'use client';

import { memo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color?: 'violet' | 'acid' | 'amber' | 'red';
  prefix?: string;
  suffix?: string;
  index?: number;
}

const colorMap = {
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  acid:   { bg: 'bg-acid-400/10',   text: 'text-acid-400',   border: 'border-acid-400/20'   },
  amber:  { bg: 'bg-amber-400/10',  text: 'text-amber-400',  border: 'border-amber-400/20'  },
  red:    { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20'    },
};

export const StatsCard = memo(function StatsCard({
  title, value, change, icon: Icon, color = 'violet', prefix = '', suffix = '',
}: StatsCardProps) {
  const colors = colorMap[color];
  const isPositive = (change ?? 0) >= 0;
  const formattedValue = typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <div
      className={cn('glass rounded-2xl p-6 border stats-card-enter', colors.border)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-xl', colors.bg)}>
          <Icon size={20} className={colors.text} />
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-acid-400' : 'text-red-400')}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-white/50 mb-1">{title}</p>
      <p className={cn('font-syne text-2xl font-bold', colors.text)}>
        {prefix}{formattedValue}{suffix}
      </p>
    </div>
  );
});
