'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@/types';

// Recently viewed products live ONLY in this browser's localStorage. Nothing
// is sent to the server, and the rail offers an explicit clear control.
const KEY = 'nexmart_recently_viewed';
const LIMIT = 8;

export function readRecentlyViewed(): Product[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Product => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<Product>;
      return typeof candidate._id === 'string' && typeof candidate.slug === 'string' && typeof candidate.name === 'string';
    }).slice(0, LIMIT);
  } catch {
    return [];
  }
}

function write(items: Product[]): void {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch { /* storage full or blocked — the rail simply goes without */ }
}

/** Record a viewed product (called by the product detail page). */
export function recordRecentlyViewed(product: Product): void {
  try {
    const next = [product, ...readRecentlyViewed().filter(item => item._id !== product._id)].slice(0, LIMIT);
    write(next);
  } catch { /* optional */ }
}

/** Read the stored list with clear support (called by the homepage rail). */
export function useRecentlyViewed() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => { setItems(readRecentlyViewed()); }, []);
  const clear = useCallback(() => { write([]); setItems([]); }, []);
  return { items, clear };
}
