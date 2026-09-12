'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Clock, Loader2, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, Product } from '@/types';
import api from '@/lib/api';
import { categoryQueryOptions } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { ProductImage } from '@/components/product/ProductImage';
import { CategoryIcon } from '@/components/product/CategoryIcon';

interface SearchBarProps { id?: string; onClose?: () => void }

export function SearchBar({ id, onClose }: SearchBarProps) {
  const router = useRouter();
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const trimmed = value.trim();
  const debounced = useDebounce(trimmed, 300);
  const categories = useQuery(categoryQueryOptions);
  const query = useQuery({
    queryKey: ['storefront', 'suggestions', debounced],
    queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/search', { params: { q: debounced, limit: 5 }, signal }).then(r => r.data.data ?? []),
    enabled: open && debounced.length >= 2 && debounced === trimmed,
    staleTime: 30_000,
  });
  const waiting = trimmed.length >= 2 && (debounced !== trimmed || query.isPending);
  const products = !waiting && !query.isError ? query.data ?? [] : [];
  const matchingCategories = trimmed.length >= 2 ? (categories.data ?? []).filter(category => category.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 3) : [];
  const options = trimmed.length < 2
    ? recent.map(text => ({ label: text, href: `/search?q=${encodeURIComponent(text)}`, kind: 'recent' as const, product: undefined as Product | undefined }))
    : [
      ...matchingCategories.map(category => ({ label: category.name, href: `/categories/${category.slug}`, kind: 'category' as const, product: undefined as Product | undefined })),
      ...products.map(product => ({ label: product.name, href: `/products/${product.slug}`, kind: 'product' as const, product })),
      { label: `Search for “${trimmed}”`, href: `/search?q=${encodeURIComponent(trimmed)}`, kind: 'all' as const, product: undefined as Product | undefined },
    ];

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('nexmart_recent_searches') || '[]');
      if (Array.isArray(parsed)) setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 5));
    } catch { /* Search remains usable without storage. */ }
    // Focus is never taken on mount: inside a drawer that would pre-empt the
    // overlay's focus bookkeeping. The drawer asks for it via `initialFocus`.
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => { setActive(-1); }, [trimmed, query.data]);
  useEffect(() => {
    if (active >= 0) document.getElementById(`${uid}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, uid]);

  function remember(text: string) {
    if (!text) return;
    const next = [text, ...recent.filter(item => item !== text)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem('nexmart_recent_searches', JSON.stringify(next)); } catch { /* optional */ }
  }
  function close() { remember(trimmed); setOpen(false); setActive(-1); onClose?.(); }
  function submit() {
    if (open && active >= 0 && options[active]) router.push(options[active].href);
    else if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    else return;
    close();
  }

  return <div ref={container} className="relative w-full" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <form role="search" onSubmit={event => { event.preventDefault(); submit(); }} className="flex min-h-12 items-center rounded-xl border border-white/25 bg-space-800 focus-within:border-violet-300">
      <Search size={18} className="ml-3 shrink-0 text-muted" aria-hidden />
      <input ref={input} id={id || `${uid}-search`} type="search" name="q" value={value} maxLength={200}
        placeholder="Search products or brands…" autoComplete="off" enterKeyHint="search" aria-label="Search products or brands"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${uid}-results` : undefined} aria-activedescendant={open && active >= 0 ? `${uid}-option-${active}` : undefined}
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-white placeholder:text-muted focus-visible:outline-none sm:text-sm"
        onChange={event => { setValue(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            if (options.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1));
          }
        }} />
      {value && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => { setValue(''); input.current?.focus(); }}><X size={17} aria-hidden /></button>}
      <button type="submit" aria-label="Submit search" className="icon-button mr-1 text-violet-200"><ArrowUpRight size={19} aria-hidden /></button>
    </form>
    {open && <div className="search-panel absolute inset-x-0 top-full z-50 mt-2 max-h-[min(65dvh,480px)] overflow-y-auto overscroll-contain rounded-xl border border-white/20 bg-space-800 shadow-lg">
      {trimmed.length < 2 && <div className="flex items-center justify-between gap-2 px-3 py-2"><p className="text-xs text-muted">{recent.length ? 'Recent searches' : 'Type at least 2 characters for suggestions'}</p>{recent.length > 0 && <button type="button" className="min-h-11 px-2 text-xs text-secondary" onClick={() => { setRecent([]); try { localStorage.removeItem('nexmart_recent_searches'); } catch { /* optional */ } }}>Clear recent</button>}</div>}
      {waiting && <p role="status" className="flex items-center gap-2 p-4 text-sm text-secondary"><Loader2 size={16} className="animate-spin" aria-hidden />Searching…</p>}
      {!waiting && trimmed.length >= 2 && query.isError && <div className="p-3 text-sm text-red-300" role="status">Suggestions are unavailable. <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>Try again</button></div>}
      {!waiting && trimmed.length >= 2 && !query.isError && !products.length && !matchingCategories.length && <p role="status" className="p-4 text-sm text-secondary">No suggestions. Try a product name or another spelling.</p>}
      <ul id={`${uid}-results`} role="listbox" aria-label="Search suggestions">
        {options.map((option, index) => <li key={`${option.kind}-${option.href}`} role="presentation"><Link id={`${uid}-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1} href={option.href} onMouseDown={event => event.preventDefault()} onClick={close} className={`flex min-h-12 items-center gap-3 p-3 text-sm hover:bg-white/5 ${active === index ? 'bg-violet-500/15' : ''}`}>
          {option.product ? <span className="product-stage relative h-11 w-11 shrink-0 overflow-hidden rounded-md"><ProductImage src={option.product.images?.[0]} alt="" sizes="44px" className="p-1" /></span> : option.kind === 'category' ? <CategoryIcon name={option.label} size={18} /> : option.kind === 'recent' ? <Clock size={17} className="shrink-0 text-muted" aria-hidden /> : <Search size={17} className="shrink-0 text-violet-200" aria-hidden />}
          <span className="min-w-0 flex-1 break-words"><span className="line-clamp-2">{option.label}</span>{option.kind === 'category' && <span className="text-xs text-muted">Category</span>}</span>
          {option.product?.variants?.[0] && <span className="shrink-0 font-mono text-xs">{formatPrice(option.product.variants[0].price)}</span>}
        </Link></li>)}
      </ul>
    </div>}
  </div>;
}
