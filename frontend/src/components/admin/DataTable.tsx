'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
}

// Stable skeleton rows — prevents recreation on each render
const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

export function DataTable<T extends Record<string, unknown>>({
  columns, data, isLoading, page = 1, totalPages = 1,
  onPageChange, searchable, onSearch, actions, emptyMessage = 'No data found',
  expandableRender, rowIdKey = '_id'
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const handlePrevPage = useCallback(() => onPageChange?.(page - 1), [onPageChange, page]);
  const handleNextPage = useCallback(() => onPageChange?.(page + 1), [onPageChange, page]);
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onSearch?.(e.target.value), [onSearch]);

  // Memoize sorted data to avoid re-sorting on unrelated renders
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp = (av as string) < (bv as string) ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

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
              onChange={handleSearch}
              className="input pl-9 py-2 text-sm"
              suppressHydrationWarning
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider',
                    col.className,
                    col.sortable && 'cursor-pointer hover:text-white/60 select-none',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="table-header text-left px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              SKELETON_ROWS.map((i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-3/4 skeleton rounded" />
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3"><div className="h-4 w-16 skeleton rounded" /></td>}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center py-16 text-white/60 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
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
              })
            )}
          </tbody>
        </table>
      </div>

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
