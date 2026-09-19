'use client';

import { useId, useState } from 'react';
import { ChevronDown, RotateCcw, Star } from 'lucide-react';
import type { CatalogFacets, Category } from '@/types';
import { parentId, rootCategories } from '@/lib/catalog';
import { formatPrice } from '@/lib/utils';

const fields = ['category', 'brand', 'minPrice', 'maxPrice', 'rating', 'inStock', 'featured'];
export function CatalogFilters({ params, categories, facets, categorySlug, instant = false, apply }: { params: URLSearchParams; categories: Category[]; facets?: CatalogFacets; categorySlug?: string; instant?: boolean; apply: (values: Record<string, string>) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(key => [key, params.get(key) || ''])));
  const [expanded, setExpanded] = useState<string[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [error, setError] = useState('');
  const selected = (key: string) => (draft[key] || '').split(',').filter(Boolean);
  const counts = new Map(facets?.categories.map(category => [category.value, category.count]));
  const brandChoices = [...(facets?.brands ?? [])];
  for (const value of selected('brand')) if (!brandChoices.some(brand => brand.value === value)) brandChoices.push({ value, count: 0 });

  function submit(values = draft) {
    if (values.minPrice && values.maxPrice && Number(values.minPrice) > Number(values.maxPrice)) { setError('Maximum price must be at least the minimum price.'); return; }
    setError(''); apply({ ...values, category: categorySlug || values.category });
  }
  function change(key: string, value: string, commit = true) {
    const values = { ...draft, [key]: value };
    setDraft(values);
    if (instant && commit) submit(values);
  }
  function toggle(key: string, value: string) {
    const values = selected(key);
    change(key, (values.includes(value) ? values.filter(item => item !== value) : [...values, value]).join(','));
  }
  function clear() { const values = Object.fromEntries(fields.map(key => [key, ''])); setDraft(values); submit(values); }

  const categoryCheck = (category: Category) => <label className="filter-check flex-1"><input type="checkbox" checked={selected('category').includes(category.slug)} onChange={() => toggle('category', category.slug)} /><span>{category.name}</span><span className="filter-count">{counts.get(category.slug) ?? category.productCount ?? ''}</span></label>;
  return <form onSubmit={event => { event.preventDefault(); submit(); }}>
    {!categorySlug && <details open className="filter-group"><summary>Category<ChevronDown size={15} aria-hidden /></summary><div className="mt-3 max-h-80 overflow-y-auto pr-1">{rootCategories(categories).map(category => {
      const children = categories.filter(child => parentId(child) === category._id);
      const open = expanded.includes(category._id);
      return <div key={category._id}><div className="flex items-center gap-1">{categoryCheck(category)}{children.length > 0 && <button type="button" aria-label={`${open ? 'Hide' : 'Show'} ${category.name} subcategories`} aria-expanded={open} className="flex min-h-11 w-11 shrink-0 items-center justify-center text-muted" onClick={() => setExpanded(current => open ? current.filter(value => value !== category._id) : [...current, category._id])}><ChevronDown size={13} className={open ? 'rotate-180' : ''} aria-hidden /></button>}</div>{open && <div className="ml-2 border-l border-white/20 pl-3">{children.map(child => <div key={child._id}>{categoryCheck(child)}</div>)}</div>}</div>;
    })}</div></details>}
    <details open className="filter-group"><summary>Price range<ChevronDown size={15} aria-hidden /></summary>
      {facets?.price && <p className="mt-3 text-xs leading-relaxed text-muted">{formatPrice(facets.price.min)} – {formatPrice(facets.price.max)} in this selection</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">{[{ key: 'minPrice', label: 'Min', placeholder: '₹ 0' }, { key: 'maxPrice', label: 'Max', placeholder: 'No limit' }].map(field => <div key={field.key}><label htmlFor={`${id}-${field.key}`} className="field-label text-xs">{field.label}</label><input id={`${id}-${field.key}`} className="input px-2.5" type="number" inputMode="decimal" min="0" step="0.01" value={draft[field.key]} placeholder={field.placeholder} onChange={event => change(field.key, event.target.value, false)} onBlur={() => { if (instant) submit(); }} aria-invalid={!!error} aria-describedby={error ? `${id}-price-error` : undefined} /></div>)}</div>
      {error && <p id={`${id}-price-error`} role="alert" className="field-error">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{[999, 4999, 19999].map(price => <button key={price} type="button" className="min-h-11 rounded-lg border border-white/20 px-2.5 text-xs text-secondary hover:border-violet-300" onClick={() => { const values = { ...draft, minPrice: '', maxPrice: String(price) }; setDraft(values); if (instant) submit(values); }}>Under {formatPrice(price)}</button>)}</div>
    </details>
    <details open className="filter-group"><summary>Brand<ChevronDown size={15} aria-hidden /></summary><label htmlFor={`${id}-brand`} className="sr-only">Find a brand</label><input id={`${id}-brand`} type="search" className="input mt-3" placeholder="Find a brand" value={brandSearch} onChange={event => setBrandSearch(event.target.value)} /><div className="mt-2 max-h-52 overflow-y-auto pr-1">{brandChoices.filter(brand => brand.value.toLowerCase().includes(brandSearch.toLowerCase())).map(brand => <label key={brand.value} className="filter-check"><input type="checkbox" checked={selected('brand').includes(brand.value)} onChange={() => toggle('brand', brand.value)} /><span>{brand.value}</span><span className="filter-count">{brand.count}</span></label>)}{brandChoices.length === 0 && <p className="py-3 text-xs text-muted">No brands in this selection.</p>}</div></details>
    <details open className="filter-group"><summary>Customer rating<ChevronDown size={15} aria-hidden /></summary><div className="mt-3">{['', '4', '3'].map(rating => <label key={rating} className="filter-check"><input type="radio" name={`${id}-rating`} checked={draft.rating === rating} onChange={() => change('rating', rating)} />{rating && <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />}<span>{rating ? `${rating} & above` : 'All ratings'}</span></label>)}</div></details>
    <div className="filter-group"><label className="filter-check"><input type="checkbox" checked={draft.inStock === 'true'} onChange={event => change('inStock', event.target.checked ? 'true' : '')} />Available to buy</label><label className="filter-check"><input type="checkbox" checked={draft.featured === 'true'} onChange={event => change('featured', event.target.checked ? 'true' : '')} />Curated picks</label></div>
    {!instant && <button type="submit" className="btn-primary w-full">Apply filters</button>}
    <button type="button" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-xs text-secondary" onClick={clear}><RotateCcw size={13} aria-hidden />Reset all filters</button>
  </form>;
}
