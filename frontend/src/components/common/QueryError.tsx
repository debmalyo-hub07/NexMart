'use client';

import { RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  /** What could not be loaded — "Orders", "Featured products", "Categories". */
  label: string;
  onRetry: () => void;
}

/**
 * The one error branch for data-dependent screens (CLAUDE.md §5.2). A failed
 * request must never render as an empty state — this is the shared retry
 * block every query consumer shows instead of re-implementing it per page.
 */
export function QueryError({ label, onRetry }: QueryErrorProps) {
  return (
    <div className="border border-red-400/25 bg-red-400/5 p-6 text-center sm:p-8" role="alert">
      <p className="text-sm text-red-300">{label} could not be loaded.</p>
      <p className="mt-1 text-meta text-white/55">Check your connection, then try again.</p>
      <button type="button" onClick={onRetry} className="btn-secondary mt-5 min-h-11 px-4">
        <RefreshCw size={15} aria-hidden /> Try again
      </button>
    </div>
  );
}
