'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

/** Context passed as the second argument to the actions renderer */
export interface ActionContext {
  isExpanded: boolean;
  toggleExpanded: () => void;
}

/** Server-driven sort state — owned by the page, applied by the backend query */
export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  searchable?: boolean;
  onSearch?: (q: string) => void;
  actions?: (row: T, ctx: ActionContext) => React.ReactNode;
  emptyMessage?: string;
  expandableRender?: (row: T) => React.ReactNode;
  rowIdKey?: string; // e.g. '_id'
  /** Current server-side sort — drives aria-sort and the active indicator */
  sort?: SortState;
  /**
   * Server-driven sort handler. When provided, `sortable: true` columns render
   * as sort buttons that call this with the column key (the page wires it into
   * its query). When omitted, `sortable` is a no-op — the data is never
   * re-sorted locally, because sorting one paginated slice is not sorting.
   */
  onSortChange?: (key: string) => void;
}

// Stable skeleton rows — prevents recreation on each render
const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

// Search keystrokes are debounced before reaching the page callback — one
// request per pause in typing instead of one request per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export function DataTable<T extends Record<string, unknown>>({
  columns, data, isLoading, page = 1, totalPages = 1,
  onPageChange, searchable, onSearch, actions, emptyMessage = 'No data found',
  expandableRender, rowIdKey = '_id', sort, onSortChange,
}: DataTableProps<T>) {
  // Raw input value — controlled locally so typing stays immediate
  const [searchInput, setSearchInput] = useState('');
  // Suppresses the debounce effect until the user has actually typed,
  // so mounting does not fire onSearch('')
  const [hasTyped, setHasTyped] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Latest-callback ref — the debounce timer must not be reset whenever the
  // parent re-renders with a fresh inline onSearch identity (auto-sync).
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Propagate the search value 300ms after the last keystroke; the timer is
  // cleared on every new keystroke and on unmount.
  useEffect(() => {
    if (!hasTyped) return;
    const timer = setTimeout(() => onSearchRef.current?.(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, hasTyped]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePrevPage = useCallback(() => onPageChange?.(page - 1), [onPageChange, page]);
  const handleNextPage = useCallback(() => onPageChange?.(page + 1), [onPageChange, page]);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHasTyped(true);
    setSearchInput(e.target.value);
  }, []);

  // Sorting is server-driven: only pages that pass onSortChange get sort
  // controls, and the rows below render in the order the backend returned.
  const serverSortable = !!onSortChange;
  const colCount = columns.length + (actions ? 1 : 0);

  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-white/5">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={handleSearchChange}
              aria-label="Search"
              className="input pl-9 py-2 text-sm"
              suppressHydrationWarning
            />
          </div>
        </div>
      )}

      {isLoading ? (
        /* Shared skeleton — stacks like the card view below lg, lines up
           like table columns from lg up */
        <div>
          {SKELETON_ROWS.map((i) => (
            <div key={i} className="px-4 py-4 border-b border-white/5 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
              <div className="h-4 skeleton rounded w-3/4 lg:w-[30%]" />
              <div className="h-4 skeleton rounded w-1/2 lg:w-[18%]" />
              <div className="h-4 skeleton rounded w-1/3 lg:w-[12%]" />
              <div className="h-4 skeleton rounded w-16 lg:ml-auto" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-center py-16 text-white/60 text-sm">{emptyMessage}</p>
      ) : (
        <>
          {/* ── Desktop (lg+): table ─────────────────────────────────── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {columns.map((col) => {
                    const canSort = serverSortable && !!col.sortable;
                    const isSorted = canSort && sort?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={cn(
                          'text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider',
                          col.className,
                        )}
                        aria-sort={canSort
                          ? (isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none')
                          : undefined}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={() => onSortChange?.(col.key)}
                            className="flex items-center gap-1 text-xs font-semibold text-white/60 uppercase tracking-wider rounded-md hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 transition-colors"
                          >
                            {col.header}
                            {isSorted ? (
                              sort?.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-white/25" />
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">{col.header}</div>
                        )}
                      </th>
                    );
                  })}
                  {actions && <th scope="col" className="table-header text-left px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const rowId = String(row[rowIdKey] ?? i);
                  const isExpanded = expandedRows.has(rowId);
                  const isClickable = !!expandableRender;
                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={cn('table-row transition-colors', isClickable && 'cursor-pointer hover:bg-white/[0.02]', isExpanded && 'bg-white/[0.02]')}
                        style={{ animationDelay: `${i * 20}ms` }}
                        onClick={isClickable ? () => toggleRow(rowId) : undefined}
                      >
                        {columns.map((col) => (
                          <td key={col.key} className={cn('table-cell relative', col.className)}>
                            {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                          </td>
                        ))}
                        {actions && (
                          <td className="table-cell" onClick={isClickable ? (e) => e.stopPropagation() : undefined}>
                            {actions(row, { isExpanded, toggleExpanded: () => toggleRow(rowId) })}
                          </td>
                        )}
                      </tr>
                      {isExpanded && expandableRender && (
                        <tr>
                          <td colSpan={colCount} className="p-0 border-b border-white/5 bg-black/20">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-l-2 border-violet-500/50 ml-4 mb-4 mt-2 bg-white/[0.02] rounded-r-xl">
                                {expandableRender(row)}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile (<lg): stacked cards ───────────────────────────── */}
          <div className="lg:hidden space-y-3 p-4">
            {data.map((row, i) => {
              const rowId = String(row[rowIdKey] ?? i);
              const isExpanded = expandedRows.has(rowId);
              const isClickable = !!expandableRender;
              return (
                <div
                  key={rowId}
                  className={cn(
                    'glass rounded-xl p-4 space-y-2',
                    isClickable && 'glass-hover cursor-pointer',
                    isExpanded && 'border-violet-500/40',
                  )}
                  onClick={isClickable ? () => toggleRow(rowId) : undefined}
                >
                  {/* Label/value grid from the visible columns */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {columns.map((col, colIdx) => (
                      <div key={col.key} className={cn('min-w-0', colIdx === 0 && 'col-span-2')}>
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">{col.header}</p>
                        <div className="min-w-0">
                          {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions row */}
                  {actions && (
                    <div
                      className="pt-2.5 border-t border-white/5"
                      onClick={isClickable ? (e) => e.stopPropagation() : undefined}
                    >
                      {actions(row, { isExpanded, toggleExpanded: () => toggleRow(rowId) })}
                    </div>
                  )}

                  {/* Expansion */}
                  {isExpanded && expandableRender && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 border-t border-white/5">
                        {expandableRender(row)}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <p className="text-xs text-white/40">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevPage}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white transition-colors"
              suppressHydrationWarning
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNextPage}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white transition-colors"
              suppressHydrationWarning
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
