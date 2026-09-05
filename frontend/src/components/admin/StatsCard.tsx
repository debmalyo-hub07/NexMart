'use client';

import { memo } from 'react';
import { LucideIcon, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  /** Real value from the API — undefined while loading or on error. */
  value?: string | number;
  icon: LucideIcon;
  color?: 'violet' | 'acid' | 'amber' | 'red';
  prefix?: string;
  suffix?: string;
  index?: number;
  /** True while the query is fetching and no data is cached yet. */
  isLoading?: boolean;
  /** True when the query failed and there is no cached data to show. */
  isError?: boolean;
  /** Invoked by the "Retry" button shown in the error state. */
  onRetry?: () => void;
}

const colorMap = {
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  acid:   { bg: 'bg-acid-400/10',   text: 'text-acid-400',   border: 'border-acid-400/20'   },
  amber:  { bg: 'bg-amber-400/10',  text: 'text-amber-400',  border: 'border-amber-400/20'  },
  red:    { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20'    },
};

export const StatsCard = memo(function StatsCard({
  title, value, icon: Icon, color = 'violet', prefix = '', suffix = '',
  isLoading, isError, onRetry,
}: StatsCardProps) {
  const colors = colorMap[color];
  const formattedValue = typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <div
      className={cn('glass rounded-2xl p-6 border stats-card-enter', colors.border)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-xl', colors.bg)}>
          <Icon size={20} className={colors.text} />
        </div>
        {isError && onRetry && (
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
      <p className="text-sm text-white/50 mb-1">{title}</p>
      {isError ? (
        <p className="font-syne text-2xl font-bold text-white/30">—</p>
      ) : isLoading || value === undefined ? (
        <div className="h-8 w-24 rounded-lg skeleton" aria-hidden="true" />
      ) : (
        <p className={cn('font-syne text-2xl font-bold', colors.text)}>
          {prefix}{formattedValue}{suffix}
        </p>
      )}
    </div>
  );
});
