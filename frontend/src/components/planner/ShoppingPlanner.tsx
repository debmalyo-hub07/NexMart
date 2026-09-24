'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { z } from 'zod';
import api, { getApiError } from '@/lib/api';
import { categoryQueryOptions, rootCategories } from '@/lib/catalog';
import { calculateTotals, variantLabel } from '@/lib/commerce';
import { displayVariant, productHref, productName } from '@/lib/productPresentation';
import { formatPrice } from '@/lib/utils';
import { ProductImage } from '@/components/product/ProductImage';
import { QueryError } from '@/components/common/QueryError';
import { useCartStore } from '@/store/cartStore';
import type { ApiResponse, Product } from '@/types';

const savedPlan = z.object({ budget: z.number().finite().min(0).max(10000000), items: z.array(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i), sku: z.string().min(1).max(120), name: z.string().max(200), quantity: z.number().int().min(1).max(10) })).max(20).refine(items => new Set(items.map(item => item.productId)).size === items.length) });
type PlanItem = z.infer<typeof savedPlan>['items'][number];
const storageKey = 'nexmart-shopping-plan-v1';

export function ShoppingPlanner() {
  const [budget, setBudget] = useState(5000);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [ready, setReady] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [cartAttempted, setCartAttempted] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem(storageKey);
      const parsed = value ? savedPlan.safeParse(JSON.parse(value)) : undefined;
      if (parsed?.success) { setBudget(parsed.data.budget); setItems(parsed.data.items); }
    } catch { setSaveNotice('Browser storage is unavailable. Your plan will last for this visit.'); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ budget, items })); }
    catch { setSaveNotice('This browser could not save your plan. Keep this tab open.'); }
  }, [budget, items, ready]);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const categories = useQuery(categoryQueryOptions);
  const catalog = useQuery({ queryKey: ['planner', 'catalog', debounced, category, page], queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products', { signal, params: { search: debounced || undefined, category: category || undefined, page, limit: 9, inStock: 'true' } }).then(r => r.data), staleTime: 30000 });
  const products = useQueries({ queries: items.map(item => ({ queryKey: ['planner', 'item', item.productId], queryFn: async () => (await api.get<ApiResponse<Product>>(`/products/${item.productId}`)).data.data, staleTime: 15000, refetchInterval: 60000 })) });
  const rows = items.map((item, index) => {
    const product = products[index]?.data;
    const variant = product?.variants.find(option => option.sku === item.sku);
    return { item, product, variant, available: !!product && !product.isDemo && !!variant && variant.stock >= item.quantity && product.isPublished !== false, loading: products[index]?.isPending };
  });
  const totals = calculateTotals(rows.filter(row => row.variant).map(row => ({ price: row.variant!.price, quantity: row.item.quantity, taxRateBps: row.product?.taxRateBps })));
  const remaining = Math.round((budget - totals.total) * 100) / 100;
  const complete = rows.every(row => row.available);
  const fingerprint = useMemo(() => JSON.stringify(items), [items]);
  useEffect(() => { setCartAttempted(false); setCartMessage(''); }, [fingerprint]);

  function add(product: Product) {
    const variant = displayVariant(product);
    if (!variant || variant.stock < 1 || product.isDemo) return;
    if (items.some(item => item.productId === product._id)) return;
    if (items.length >= 20) { setSaveNotice('Your plan can hold 20 products. Remove an item to make room.'); return; }
    setItems(previous => [...previous, { productId: product._id, sku: variant.sku, name: productName(product), quantity: 1 }]);
  }
  function change(productId: string, update: Partial<PlanItem>) { setItems(previous => previous.map(item => item.productId === productId ? { ...item, ...update } : item)); }
  async function addPlanToCart() {
    if (pending.current || !items.length || !complete || cartAttempted) return;
    pending.current = true; setAdding(true); setCartMessage('');
    let added = 0;
    try {
      await useCartStore.getState().fetchCart();
      if (!useCartStore.getState().ready || useCartStore.getState().error) throw new Error('Load your cart before adding the plan.');
      // Use the same validated cart writes as the storefront. Never resubmit
      // a failed/ambiguous batch automatically; the shopper reviews the cart.
      setCartAttempted(true);
      for (const row of rows) {
        await useCartStore.getState().addItem(row.item.productId, row.item.sku, row.item.quantity, undefined, false);
        added += 1;
      }
      setCartMessage(`${added} ${added === 1 ? 'product added' : 'products added'} to your cart. Review the final quantities and prices before checkout.`);
    } catch (error) {
      setCartMessage(`${added ? `${added} products confirmed. ` : ''}${getApiError(error)} Check your cart before adding anything again; a delayed response may still have added an item.`);
    } finally { pending.current = false; setAdding(false); }
  }

  return <main id="main-content" className="store-page"><div className="page-container">
    <section className="plan-intro"><div><p className="eyebrow">A little forethought goes a long way</p><h1>Make room for<br />what matters.</h1><p>Build your next basket around a budget. See the whole cost, including delivery, as you choose.</p><span className="inline-flex items-center gap-2 text-xs text-secondary"><Check size={15} aria-hidden />{saveNotice || 'Saved in this browser. Ready when you are.'}</span></div><div className="plan-intro-photo"><Image src="/images/collections/workspace.webp" alt="A considered workspace with everyday essentials" fill sizes="(max-width: 767px) 100vw, 40vw" priority /></div></section>
    <div className="plan-workspace">
      <section className="min-w-0" aria-labelledby="planner-products-heading"><div className="section-title-row"><div><p className="eyebrow">Start with the things you need</p><h2 id="planner-products-heading" className="text-2xl">Find a place in your plan.</h2></div></div>
        <div className="mb-5 flex flex-wrap gap-3"><label className="relative min-w-0 flex-1"><span className="sr-only">Search products for your plan</span><Search size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden /><input value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Search for something you need" type="search" /></label><label className="min-w-0"><span className="sr-only">Department</span><select className="input max-w-full" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All departments</option>{(ready ? rootCategories(categories.data || []) : []).map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></div>
        {!ready || catalog.isPending ? <p role="status" className="py-10 text-sm text-muted">Finding products…</p> : catalog.isError ? <QueryError label="Products" onRetry={() => void catalog.refetch()} /> : !catalog.data.data?.length ? <p className="rounded-xl border border-[var(--border)] p-6 text-sm text-secondary">No products match. Try another search or department.</p> : <div className="plan-products">{catalog.data.data.map(product => {
          const variant = displayVariant(product); const selected = items.some(item => item.productId === product._id); const unavailable = product.isDemo || !variant?.stock;
          return <article key={product._id} className="plan-product"><Link className="product-stage relative block aspect-square rounded-lg" href={productHref(product)}><ProductImage src={variant?.images?.[0] || product.images?.[0]} alt={productName(product)} sizes="(max-width: 767px) 42vw, 220px" className="p-4" /></Link><p className="mt-3 text-xs text-muted">{product.brand}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold"><Link href={productHref(product)}>{productName(product)}</Link></h3><p className="mt-2 text-base font-bold">{variant ? formatPrice(variant.price) : 'Unavailable'}</p><p className="mt-1 min-h-5 truncate text-xs text-muted">{variant && variantLabel(variant)}</p><button type="button" className={`mt-3 w-full ${selected ? 'btn-secondary' : 'btn-primary'}`} onClick={() => add(product)} disabled={selected || unavailable || adding || items.length >= 20}>{selected ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}{selected ? 'In your plan' : unavailable ? 'Unavailable' : 'Add to plan'}</button></article>;
        })}</div>}
        {(catalog.data?.meta?.totalPages || 0) > 1 && <nav aria-label="Planner product pages" className="mt-5 flex items-center justify-between gap-2"><button type="button" className="btn-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span className="text-sm text-muted">{page} / {catalog.data?.meta?.totalPages}</span><button type="button" className="btn-secondary" disabled={page >= (catalog.data?.meta?.totalPages || 1)} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
      </section>
      <aside className="plan-basket" aria-labelledby="plan-heading"><p className="eyebrow">The complete picture</p><h2 id="plan-heading" className="mt-3 text-2xl">Your next basket</h2><label htmlFor="plan-budget" className="field-label mt-5 block">Your budget (₹)</label><input id="plan-budget" className="input mt-2 text-xl font-semibold" type="number" min="0" max="10000000" step="1" value={budget} onChange={e => setBudget(Math.min(10000000, Math.max(0, Number(e.target.value) || 0)))} />
        <div className="plan-budget-meter" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budget ? Math.min(100, Math.round(totals.total / budget * 100)) : 0}><span style={{ width: `${budget ? Math.min(100, totals.total / budget * 100) : 0}%`, background: remaining < 0 ? '#B42332' : undefined }} /></div><p className={`text-sm font-semibold ${remaining < 0 ? 'text-red-800' : 'text-green-800'}`}>{remaining < 0 ? `${formatPrice(-remaining)} over your budget` : `${formatPrice(remaining)} left in your budget`}{!complete && ' · known prices only'}</p>
        {!ready ? <p className="py-8 text-sm text-muted" role="status">Opening your saved plan…</p> : !items.length ? <div className="my-6 rounded-lg border border-dashed border-[var(--border-control)] px-5 py-8 text-sm leading-6 text-secondary">Your plan starts here. Add a product, then adjust its option and quantity.</div> : <ul className="my-5 divide-y divide-[var(--border)]">{rows.map(row => <li key={row.item.productId} className="py-4"><div className="flex items-start gap-3"><div className="product-stage relative h-16 w-16 shrink-0 rounded-md"><ProductImage src={row.variant?.images?.[0] || row.product?.images?.[0]} alt="" sizes="64px" className="p-1" /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{row.item.name}</p><p className="mt-1 text-sm">{row.variant ? formatPrice(row.variant.price * row.item.quantity) : row.loading ? 'Updating price…' : 'Price unavailable'}</p></div><button type="button" className="icon-button -mr-2 shrink-0" aria-label={`Remove ${row.item.name} from plan`} disabled={adding} onClick={() => setItems(previous => previous.filter(item => item.productId !== row.item.productId))}><Trash2 size={17} aria-hidden /></button></div>
          {row.product && <select aria-label={`Option for ${row.item.name}`} value={row.item.sku} disabled={adding} onChange={e => change(row.item.productId, { sku: e.target.value, quantity: 1 })} className="input mt-3 text-xs">{row.product.variants.map(variant => <option key={variant.sku} value={variant.sku}>{variantLabel(variant)} — {formatPrice(variant.price)}{variant.stock < 1 ? ' · out of stock' : ''}</option>)}</select>}
          <div className="mt-3 flex items-center justify-between gap-2"><div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white"><button type="button" className="icon-button" aria-label={`Decrease quantity of ${row.item.name}`} disabled={row.item.quantity <= 1 || adding} onClick={() => change(row.item.productId, { quantity: row.item.quantity - 1 })}><Minus size={15} aria-hidden /></button><span className="w-5 text-center text-sm" aria-label={`Quantity ${row.item.quantity}`}>{row.item.quantity}</span><button type="button" className="icon-button" aria-label={`Increase quantity of ${row.item.name}`} disabled={row.item.quantity >= Math.min(10, row.variant?.stock || 0) || adding} onClick={() => change(row.item.productId, { quantity: row.item.quantity + 1 })}><Plus size={15} aria-hidden /></button></div>{row.product && <Link className="text-link text-xs" href={`/products/${row.product.slug}?option=${encodeURIComponent(row.item.sku)}`}>Compare offers<ArrowRight size={14} aria-hidden /></Link>}</div>
          {!row.available && !row.loading && <p className="mt-2 text-xs leading-5 text-red-800">This option or quantity is unavailable. Choose another or remove it.</p>}
        </li>)}</ul>}
        <dl className="space-y-3 border-t border-[var(--border)] pt-5 text-sm"><div className="flex justify-between gap-2"><dt>Items</dt><dd>{formatPrice(totals.subtotal)}</dd></div><div className="flex justify-between gap-2"><dt>Delivery</dt><dd>{totals.shippingFee ? formatPrice(totals.shippingFee) : items.length ? 'Free' : '—'}</dd></div><div className="flex justify-between gap-2 text-lg font-semibold"><dt>Planned total</dt><dd>{formatPrice(totals.total)}</dd></div></dl><p className="mt-3 text-xs leading-6 text-muted">Delivery is ₹49 up to an item total of ₹999, free above. Prices can change. Items already in your cart are separate from this plan.</p>
        <button type="button" className="btn-primary mt-5 w-full" disabled={!ready || !items.length || !complete || adding || cartAttempted} onClick={() => void addPlanToCart()}><ShoppingBag size={17} aria-hidden />{adding ? 'Adding your plan…' : cartAttempted ? 'Review your cart' : 'Add plan to cart'}</button>{cartMessage && <p role="status" className="mt-3 text-sm leading-6 text-secondary">{cartMessage}</p>}<Link href="/cart" className="text-link mt-2 w-full">Review cart<ArrowRight size={16} aria-hidden /></Link>
      </aside>
    </div>
  </div></main>;
}
