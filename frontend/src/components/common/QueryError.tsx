'use client';

import { RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  /** What could not be loaded — "Orders", "Featured products", "Categories". */
  label: string;
  onRetry: () => void;
  detail?: string;
}

/**
 * The one error branch for data-dependent screens (CLAUDE.md §5.2). A failed
 * request must never render as an empty state — this is the shared retry
 * block every query consumer shows instead of re-implementing it per page.
 */
export function QueryError({ label, onRetry, detail }: QueryErrorProps) {
  return (
    <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-5 text-center sm:p-6" role="alert">
      <p className="text-sm text-red-300">{label} could not be loaded.</p>
      <p className="mt-1 text-sm text-secondary">{detail || 'Check your connection, then try again.'}</p>
      <button type="button" onClick={onRetry} className="btn-secondary mt-5 min-h-11 px-4">
        <RefreshCw size={15} aria-hidden /> Try again
      </button>
    </div>
  );
}
