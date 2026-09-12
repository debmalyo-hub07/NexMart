'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ArrowRight, LucideIcon, RotateCw } from 'lucide-react';
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
  /**
   * What the number actually covers. Operators compare these tiles against
   * analytics, so a tile whose scope is not stated invites a false reading.
   */
  hint?: string;
  /** Where this metric is worked on — turns the tile into a shortcut. */
  href?: string;
  /** Link text; defaults to "View". */
  hrefLabel?: string;
}

const colorMap = {
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  acid:   { bg: 'bg-acid-400/10',   text: 'text-acid-400',   border: 'border-acid-400/20'   },
  amber:  { bg: 'bg-amber-400/10',  text: 'text-amber-400',  border: 'border-amber-400/20'  },
  red:    { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20'    },
};

export const StatsCard = memo(function StatsCard({
  title, value, icon: Icon, color = 'violet', prefix = '', suffix = '',
  isLoading, isError, onRetry, hint, href, hrefLabel = 'View',
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
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <RotateCw size={12} aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
      <p className="text-sm text-secondary mb-1">{title}</p>
      {isError ? (
        <p className="font-outfit text-2xl font-bold text-muted">—</p>
      ) : isLoading || value === undefined ? (
        <div className="h-8 w-24 rounded-lg skeleton" aria-hidden="true" />
      ) : (
        <p className={cn('font-outfit text-2xl font-bold tabular-nums', colors.text)}>
          {prefix}{formattedValue}{suffix}
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
      {href && (
        <Link
          href={href}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        >
          {hrefLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
});
