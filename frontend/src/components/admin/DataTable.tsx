'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  isError?: boolean;
  onRetry?: () => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  searchable?: boolean;
  onSearch?: (q: string) => void;
  actions?: (row: T, ctx: ActionContext) => React.ReactNode;
  emptyMessage?: string;
  /** Error-branch copy — a full sentence, not derived from emptyMessage. */
  errorMessage?: string;
  expandableRender?: (row: T) => React.ReactNode;
  /**
   * Noun for the disclosure control, e.g. "order details" produces
   * "Show order details for NEX-1042". Screen-reader users get the row
   * identity, not a bare "Show details" repeated once per row.
   */
  expandLabel?: string;
  rowIdKey?: string; // e.g. '_id'
  /** Field naming a row in control labels — falls back to rowIdKey. */
  rowLabelKey?: string;
  /** Current server-side sort — drives aria-sort and the active indicator */
  sort?: SortState;
  /**
   * Server-driven sort handler. When provided, `sortable: true` columns render
   * as sort buttons that call this with the column key (the page wires it into
   * its query). A direction may be passed explicitly — the mobile control
   * chooses one rather than toggling blind. When omitted, `sortable` is a
   * no-op: the data is never re-sorted locally, because sorting one paginated
   * slice is not sorting.
   */
  onSortChange?: (key: string, direction?: 'asc' | 'desc') => void;
}

// Stable skeleton rows — prevents recreation on each render
const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

// Search keystrokes are debounced before reaching the page callback — one
// request per pause in typing instead of one request per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The one disclosure control. Every expandable table gets the same
 * keyboard-operable button — rows used to be expanded by clicking a `<tr>`,
 * which no keyboard or screen-reader user could reach. Declared at module
 * scope so toggling never remounts it and steals focus from the user.
 */
function RowExpandButton({
  rowId, isExpanded, name, expandLabel, full, onToggle,
}: {
  rowId: string;
  isExpanded: boolean;
  name: string;
  expandLabel: string;
  full?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(rowId)}
      aria-expanded={isExpanded}
      aria-controls={`row-details-${rowId}`}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-muted transition-colors hover:bg-violet-500/10 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
        full ? 'w-full border border-white/10 text-sm' : 'min-w-11',
      )}
    >
      {isExpanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
      {full && <span>{isExpanded ? 'Hide' : 'Show'} {expandLabel}</span>}
      {!full && <span className="sr-only">{isExpanded ? 'Hide' : 'Show'} {expandLabel} for {name}</span>}
    </button>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, isLoading, page = 1, totalPages = 1,
  onPageChange, searchable, onSearch, actions, emptyMessage = 'No data found',
  expandableRender, expandLabel = 'details', rowIdKey = '_id', rowLabelKey,
  sort, onSortChange, isError = false, onRetry,
  errorMessage = 'This data could not be loaded. Check your connection and try again.',
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
  const sortableColumns = serverSortable ? columns.filter(col => col.sortable) : [];
  const colCount = columns.length + (actions ? 1 : 0) + (expandableRender ? 1 : 0);

  /** Row identity used in control labels: a human field when the page names one. */
  const labelFor = (row: T, fallback: string) =>
    String((rowLabelKey && row[rowLabelKey]) ?? row[rowIdKey] ?? fallback);

  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-white/5">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
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

      {/* Sort control for narrow screens: the sortable column headers only
          exist in the lg+ table, so below that this select is the only way to
          reach server-side sorting. */}
      {sortableColumns.length > 0 && !isLoading && !isError && data.length > 0 && (
        <div className="border-b border-white/5 p-4 lg:hidden">
          <label htmlFor="datatable-sort" className="mb-1.5 block text-xs uppercase tracking-wider text-muted">Sort by</label>
          <select
            id="datatable-sort"
            value={sort ? `${sort.key}:${sort.direction}` : ''}
            onChange={(event) => {
              const [key, direction] = event.target.value.split(':');
              onSortChange?.(key, direction as 'asc' | 'desc');
            }}
            className="input min-h-11 w-full text-sm"
          >
            {sortableColumns.map((col) => (
              <optgroup key={col.key} label={col.header}>
                <option value={`${col.key}:desc`}>{col.header} — highest / newest first</option>
                <option value={`${col.key}:asc`}>{col.header} — lowest / oldest first</option>
              </optgroup>
            ))}
          </select>
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
      ) : isError ? (
        <div className="border-t border-red-400/20 bg-red-400/5 px-6 py-14 text-center" role="alert">
          <p className="text-sm text-red-300">{errorMessage}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary mt-4 min-h-11">
              <RefreshCw size={15} aria-hidden /> Retry
            </button>
          )}
        </div>
      ) : data.length === 0 ? (
        <p className="text-center py-16 text-secondary text-sm">{emptyMessage}</p>
      ) : (
        <>
          {/* ── Desktop (lg+): table ─────────────────────────────────── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {expandableRender && (
                    <th scope="col" className="w-12 px-4 py-3">
                      <span className="sr-only">Expand row</span>
                    </th>
                  )}
                  {columns.map((col) => {
                    const canSort = serverSortable && !!col.sortable;
                    const isSorted = canSort && sort?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={cn(
                          'text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider',
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
                            className="flex items-center gap-1 text-xs font-semibold text-secondary uppercase tracking-wider rounded-md hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 transition-colors"
                          >
                            {col.header}
                            {isSorted ? (
                              sort?.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-white/50" aria-hidden />
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
                  return (
                    <React.Fragment key={rowId}>
                      <tr className={cn('table-row transition-colors', isExpanded && 'bg-white/[0.02]')}>
                        {expandableRender && (
                          <td className="table-cell">
                            <RowExpandButton rowId={rowId} isExpanded={isExpanded} name={labelFor(row, `row ${i + 1}`)} expandLabel={expandLabel} onToggle={toggleRow} />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={col.key} className={cn('table-cell relative', col.className)}>
                            {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                          </td>
                        ))}
                        {actions && (
                          <td className="table-cell">
                            {actions(row, { isExpanded, toggleExpanded: () => toggleRow(rowId) })}
                          </td>
                        )}
                      </tr>
                      {isExpanded && expandableRender && (
                        <tr>
                          <td colSpan={colCount} className="p-0 border-b border-white/5 bg-black/20">
                            <div id={`row-details-${rowId}`} className="overflow-hidden">
                              <div className="p-4 border-l-2 border-violet-500/50 ml-4 mb-4 mt-2 bg-white/[0.02] rounded-r-xl">
                                {expandableRender(row)}
                              </div>
                            </div>
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
              return (
                <div
                  key={rowId}
                  className={cn('glass rounded-xl p-4 space-y-2', isExpanded && 'border-violet-500/40')}
                >
                  {/* Label/value grid from the visible columns */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {columns.map((col, colIdx) => (
                      <div key={col.key} className={cn('min-w-0', colIdx === 0 && 'col-span-2')}>
                        <p className="text-xs text-muted uppercase tracking-wider mb-0.5">{col.header}</p>
                        <div className="min-w-0">
                          {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions row */}
                  {actions && (
                    <div className="pt-2.5 border-t border-white/5">
                      {actions(row, { isExpanded, toggleExpanded: () => toggleRow(rowId) })}
                    </div>
                  )}

                  {/* Expansion */}
                  {expandableRender && (
                    <div className="pt-2.5 border-t border-white/5">
                      <RowExpandButton rowId={rowId} isExpanded={isExpanded} name={labelFor(row, `row ${i + 1}`)} expandLabel={expandLabel} onToggle={toggleRow} full />
                    </div>
                  )}
                  {isExpanded && expandableRender && (
                    <div id={`row-details-${rowId}`} className="overflow-hidden">
                      <div className="pt-3 border-t border-white/5">
                        {expandableRender(row)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between px-4 py-3 border-t border-white/5" aria-label="Pagination">
          <p className="text-xs text-muted">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-30"
              suppressHydrationWarning
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-30"
              suppressHydrationWarning
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
