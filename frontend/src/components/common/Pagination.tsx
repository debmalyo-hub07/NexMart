'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Windowed pagination: prev/next + current±2 + first/last. Pages 11+ reachable. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  const buttonBase = 'h-11 min-w-11 px-2 rounded-lg text-sm transition-colors flex items-center justify-center';
  const active = 'bg-violet-500 text-white font-medium';
  const idle = 'glass text-secondary hover:text-white hover:bg-white/[0.08]';
  const disabled = 'opacity-30 pointer-events-none';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 flex-wrap">
      <button type="button" aria-label="Previous page" disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={`${buttonBase} ${page <= 1 ? disabled : idle}`}>
        <ChevronLeft size={16} />
      </button>

      {windowStart > 1 && (
        <>
          <button type="button" onClick={() => onPageChange(1)} className={`${buttonBase} ${idle}`}>1</button>
          {windowStart > 2 && <span className="text-muted px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button key={p} type="button" aria-current={p === page ? 'page' : undefined}
          onClick={() => onPageChange(p)}
          className={`${buttonBase} ${p === page ? active : idle}`}>
          {p}
        </button>
      ))}

      {windowEnd < totalPages && (
        <>
          {windowEnd < totalPages - 1 && <span className="text-muted px-1">…</span>}
          <button type="button" onClick={() => onPageChange(totalPages)} className={`${buttonBase} ${idle}`}>{totalPages}</button>
        </>
      )}

      <button type="button" aria-label="Next page" disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={`${buttonBase} ${page >= totalPages ? disabled : idle}`}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
