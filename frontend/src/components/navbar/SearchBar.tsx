'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Clock, Search, TrendingUp, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Product } from '@/types';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  autoFocus?: boolean;
  /** Input id — lets a visible label in the embedding page target the control. */
  id?: string;
  onClose?: () => void;
}

export function SearchBar({ autoFocus = false, id, onClose }: SearchBarProps) {
  const router = useRouter();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const debouncedQuery = useDebounce(query.trim(), 300);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = localStorage.getItem('nexmart_recent_searches');
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 5));
    } catch {
      setRecent([]);
    }
  }, [mounted]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setIsLoading(false);
      setRequestError(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setRequestError(false);

    api.get(`/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`, { signal: controller.signal })
      .then(({ data }) => setResults(Array.isArray(data?.data) ? data.data : []))
      .catch((error: unknown) => {
        const name = (error as { name?: string })?.name;
        if (name !== 'CanceledError' && name !== 'AbortError') {
          setResults([]);
          setRequestError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, retryNonce]);

  const handleSearch = useCallback((value: string) => {
    const next = value.trim();
    if (!next) return;
    const nextRecent = [next, ...recent.filter((item) => item !== next)].slice(0, 5);
    try { localStorage.setItem('nexmart_recent_searches', JSON.stringify(nextRecent)); } catch { /* storage is optional */ }
    setRecent(nextRecent);
    setFocused(false);
    router.push(`/search?q=${encodeURIComponent(next)}`);
    onClose?.();
  }, [onClose, recent, router]);

  // One threshold drives both the dropdown's visibility and its content: below
  // two trimmed characters show the intro panel (recent + explore copy), at or
  // above it show results/error. Named so the two branches cannot disagree.
  const trimmed = query.trim();
  const showIntro = trimmed.length < 2;
  const showDropdown = focused && (showIntro || isLoading || requestError || results.length > 0);
  const containerClass = useMemo(() => [
    'flex min-h-11 items-center gap-2 rounded-xl px-4 transition-[background-color,box-shadow] duration-200',
    focused ? 'bg-white/[0.08] ring-1 ring-violet-500/60' : 'bg-white/5 hover:bg-white/[0.08]',
  ].join(' '), [focused]);

  return (
    <div className="relative w-full">
      <form onSubmit={(event) => { event.preventDefault(); handleSearch(query); }} className={containerClass} role="search">
        <Search size={16} className={focused ? 'text-violet-400' : 'text-white/50'} aria-hidden />
        <input
          ref={inputRef}
          id={id ?? `catalog-search-${searchId}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="Search products, brands, categories..."
          autoComplete="off"
          aria-label="Search products, brands, and categories"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          suppressHydrationWarning
        />
        {query && (
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery('')} className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white" aria-label="Clear search">
            <X size={14} aria-hidden />
          </button>
        )}
      </form>

      {showDropdown && (
          <div
            className="search-panel absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/15 bg-space-800/95 shadow-glow-violet backdrop-blur-xl"
          >
            {showIntro ? (
              <div className="space-y-4 p-4">
                {mounted && recent.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wider text-white/55"><Clock size={11} aria-hidden /> Recent searches</p>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((item) => <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleSearch(item)} className="min-h-10 rounded-lg border border-white/10 px-3 text-sm text-white/70 hover:border-violet-500/50 hover:text-white">{item}</button>)}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wider text-white/55"><TrendingUp size={11} aria-hidden /> Explore the catalog</p>
                  <p className="text-sm leading-relaxed text-white/60">Search by product, brand, or category to compare what is available now.</p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="space-y-3 p-4" aria-label="Searching">
                {[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg skeleton" /><div className="h-3 w-2/3 rounded skeleton" /></div>)}
              </div>
            ) : requestError ? (
              <div className="p-6 text-center" role="alert">
                <p className="text-sm text-red-300">Search is temporarily unavailable.</p>
                <button type="button" onClick={() => setRetryNonce((value) => value + 1)} className="mt-3 min-h-11 rounded-lg border border-red-400/30 px-3 text-sm text-red-200 hover:bg-red-400/10">Try again</button>
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-white/10">
                {results.map((product) => (
                  <button key={product._id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { router.push(`/products/${product.slug}`); onClose?.(); }} className="flex min-h-16 w-full items-center gap-3 p-3 text-left hover:bg-white/[0.05]">
                    {product.images?.[0] ? <Image src={product.images[0]} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-white/5" aria-hidden />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{product.name}</span><span className="block truncate text-meta text-white/50">{product.category?.name || 'Catalog'}</span></span>
                    <span className="shrink-0 font-mono text-sm text-acid-400">{formatPrice(product.variants?.[0]?.price || 0)}</span>
                  </button>
                ))}
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleSearch(query)} className="flex min-h-11 w-full items-center justify-center gap-2 p-3 text-sm text-violet-300 hover:bg-violet-500/10 hover:text-white"><Search size={14} aria-hidden /> View all results</button>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-white/60">No results for &ldquo;{query.trim()}&rdquo;</div>
            )}
          </div>
      )}
    </div>
  );
}
