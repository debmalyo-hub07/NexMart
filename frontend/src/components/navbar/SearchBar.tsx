'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Clock } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

interface SearchBarProps {
  autoFocus?: boolean;
  onClose?: () => void;
}

const TRENDING = ['iPhone 16', 'Samsung TV', 'Nike Shoes', 'Laptop Stand', 'Wireless Earbuds'];

// Stable animation variants — defined outside component to avoid recreation
const dropdownVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
};
const dropdownTransition = { duration: 0.15 };

export function SearchBar({ autoFocus, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const debouncedQuery = useDebounce(query, 180); // 180ms — snappy dropdown without excessive API calls
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // Track if a search request is still current to avoid stale updates
  const searchAbortRef = useRef<AbortController | null>(null);

  // Mount flag — prevents localStorage access on SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Read recent searches only after mount (client-only)
  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = localStorage.getItem('nexmart_recent_searches');
      if (stored) setRecent(JSON.parse(stored).slice(0, 5));
    } catch {
      // ignore parse errors
    }
  }, [mounted]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    // Cancel any in-flight request
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const search = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`, {
          signal: controller.signal,
        });
        setResults(data.data || []);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'CanceledError' && (err as { name?: string })?.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    search();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    try {
      const searches = [q, ...recent.filter((r) => r !== q)].slice(0, 5);
      localStorage.setItem('nexmart_recent_searches', JSON.stringify(searches));
      setRecent(searches);
    } catch {
      // ignore storage errors
    }
    setIsFocused(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onClose?.();
  }, [recent, router, onClose]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleFocus = useCallback(() => setIsFocused(true), []);

  const handleBlur = useCallback(() => {
    // Small delay so clicks on dropdown items register first
    setTimeout(() => setIsFocused(false), 100);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query);
  }, [handleSearch, query]);

  const clearQuery = useCallback(() => setQuery(''), []);

  const containerClass = useMemo(() => `flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
    isFocused
      ? 'ring-1 ring-violet-500/50 bg-white/[0.08]'
      : 'bg-white/5 hover:bg-white/[0.07]'
  }`, [isFocused]);

  const showDropdown = isFocused && (query.length === 0 || results.length > 0 || isLoading);

  return (
    <div className="relative w-full">
      <div className={containerClass}>
        <Search size={16} className={isFocused ? 'text-violet-400' : 'text-white/40'} />
        {/*
          suppressHydrationWarning: browser extensions (password managers, autofill tools)
          inject extra attributes like `fdprocessedid` after hydration — this suppresses
          the resulting React warning without disabling SSR for the whole component.
        */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search products, brands, categories..."
          className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          suppressHydrationWarning
          autoComplete="off"
        />
        {query && (
          <button onClick={clearQuery} className="text-white/40 hover:text-white/70" suppressHydrationWarning>
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={dropdownTransition}
            className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl border border-white/[0.08] overflow-hidden z-50 shadow-glow-violet"
          >
            {/* No query — show trending + recent */}
            {!query && (
              <div className="p-4 space-y-4">
                {mounted && recent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock size={10} /> Recent
                    </p>
                    {recent.map((r) => (
                      <button key={r} onClick={() => handleSearch(r)} className="block w-full text-left px-2 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors" suppressHydrationWarning>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp size={10} /> Trending
                  </p>
                  {TRENDING.map((t) => (
                    <button key={t} onClick={() => handleSearch(t)} className="block w-full text-left px-2 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors" suppressHydrationWarning>
                      🔥 {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search results */}
            {query.length >= 2 && (
              <div className="divide-y divide-white/5">
                {isLoading && (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-lg skeleton" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-2/3 rounded skeleton" />
                          <div className="h-2.5 w-1/3 rounded skeleton" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && results.map((product) => (
                  <button
                    key={product._id}
                    onClick={() => { router.push(`/products/${product.slug}`); onClose?.(); }}
                    onMouseEnter={() => router.prefetch(`/products/${product.slug}`)}
                    className="flex items-center gap-3 w-full p-3 hover:bg-white/[0.04] transition-colors text-left"
                    suppressHydrationWarning
                  >
                    {product.images[0] && (
                      <Image src={product.images[0]} alt={product.name} width={40} height={40} className="rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{product.name}</p>
                      <p className="text-xs text-white/40">{product.category?.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-acid-400 shrink-0">
                      {formatPrice(product.variants[0]?.price)}
                    </p>
                  </button>
                ))}

                {!isLoading && results.length > 0 && (
                  <button
                    onClick={() => handleSearch(query)}
                    className="w-full p-3 text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/5 transition-colors flex items-center justify-center gap-2"
                    suppressHydrationWarning
                  >
                    <Search size={14} /> View all results for &ldquo;{query}&rdquo;
                  </button>
                )}

                {!isLoading && results.length === 0 && query.length >= 2 && (
                  <div className="p-6 text-center text-sm text-white/40">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
