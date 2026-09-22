'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Grid2X2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { arrivalsQueryOptions, categoryQueryOptions, featuredQueryOptions, rootCategories } from '@/lib/catalog';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { displayVariant, productName, productHref } from '@/lib/productPresentation';
import type { ApiResponse, Category, Product } from '@/types';
import { ProductImage } from '@/components/product/ProductImage';
import { CategoryIcon } from '@/components/product/CategoryIcon';
import { ProductCard } from '@/components/product/ProductCard';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { ProductCardSkeleton, Skeleton } from '@/components/common/SkeletonLoader';

export function HomeDiscovery() {
  return <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-secondary"><span className="text-muted">Find your direction</span><Link className="inline-flex min-h-11 items-center gap-1 hover:text-[var(--text-primary)]" href="/categories/electronics">Everyday tech <ArrowUpRight size={13} aria-hidden /></Link><Link className="inline-flex min-h-11 items-center gap-1 hover:text-[var(--text-primary)]" href="/categories/home">A home refresh <ArrowUpRight size={13} aria-hidden /></Link></div>;
}

const SPOTLIGHT_INTERVAL_MS = 5000;

export function HomeSpotlight({ products }: { products?: Product[] }) {
  const query = useQuery({ ...featuredQueryOptions, initialData: products });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const choices = [...(query.data ?? [])].sort((a, b) => Number(b.category?.slug === 'electronics') - Number(a.category?.slug === 'electronics')).slice(0, 5);
  const count = Math.max(choices.length, 1);
  const index = active % count;
  const product = choices[index];
  // Vestibular safety (WCAG 2.3.3): autoplay only for users who opted into
  // motion; the CSS side mirrors this in the prefers-reduced-motion block.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  // A background tab should not cycle products the customer cannot see.
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState !== 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  // Depending on `index` also restarts the countdown after a manual pick, so a
  // just-chosen product always stays up for a full interval.
  useEffect(() => {
    if (paused || hidden || reducedMotion || choices.length < 2) return;
    const timer = window.setInterval(() => setActive(value => value + 1), SPOTLIGHT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, hidden, reducedMotion, choices.length, index]);
  if (query.isError) return <QueryError label="The curated edit" onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Skeleton className="min-h-[430px] rounded-2xl" />;
  if (!product) return <EmptyState title="Your next find is waiting" description="Take a look around the catalog." action={<Link href="/products" className="btn-primary">Explore products</Link>} />;
  const variant = displayVariant(product);
  return <article className="hero-product" data-paused={paused || undefined} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
    <div className="flex items-center justify-between gap-3 px-5 py-4"><p className="eyebrow text-orange-600">In the curated edit</p><span className="font-mono text-xs text-muted">0{index + 1} / 0{choices.length}</span></div>
    <Link href={productHref(product)} className="product-stage relative mx-5 block aspect-[4/3] overflow-hidden rounded-xl" aria-label={`Explore ${productName(product)}`}><ProductImage src={variant?.images?.[0] || product.images[0]} alt={productName(product)} priority sizes="(max-width: 639px) 85vw, (max-width: 1023px) 70vw, 480px" className="p-6 sm:p-8" /></Link>
    <div className="flex flex-1 items-end justify-between gap-4 p-5"><div className="min-w-0"><p className="mb-1 text-xs text-muted">{product.brand}{product.isDemo ? ' · Sample collection' : ''}</p><h2 className="max-w-sm text-xl leading-snug"><Link href={productHref(product)} className="line-clamp-2 hover:text-[var(--accent-violet)]">{productName(product)}</Link></h2>{variant && <p className="mt-2 font-mono text-lg">{formatPrice(variant.price)}</p>}</div><Link href={productHref(product)} className="icon-button shrink-0 rounded-full border border-[var(--border-control)]" aria-label={`View ${productName(product)}`}><ArrowUpRight size={22} aria-hidden /></Link></div>
    {choices.length > 1 && <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-2"><div className="flex gap-1">{choices.map((item, i) => <button key={item._id} type="button" className="flex h-11 w-8 items-center justify-center" aria-label={`Show featured product ${i + 1}`} aria-pressed={index === i} onClick={() => setActive(i)}><span className={`hero-dot ${index === i ? 'hero-dot-active' : ''}`}>{index === i && <span key={`${index}:${paused}`} className="hero-dot-progress" />}</span></button>)}</div><div className="flex"><button type="button" className="icon-button" aria-label="Previous featured product" onClick={() => setActive((index - 1 + choices.length) % choices.length)}><ChevronLeft size={19} aria-hidden /></button><button type="button" className="icon-button" aria-label="Next featured product" onClick={() => setActive((index + 1) % choices.length)}><ChevronRight size={19} aria-hidden /></button></div></div>}
  </article>;
}

export function HomeCategories({ categories }: { categories?: Category[] }) {
  const query = useQuery({ ...categoryQueryOptions, initialData: categories });
  const roots = rootCategories(query.data ?? []);
  return <section className="page-container section" aria-labelledby="home-categories"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">A world of possibilities</p><h2 id="home-categories" className="section-heading">What are you into?</h2></div><Link href="/categories" className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary hover:text-[var(--text-primary)]"><span className="hidden sm:inline">Explore categories</span><ArrowUpRight size={19} aria-hidden /><span className="sr-only sm:hidden">Explore categories</span></Link></div>
    {query.isError ? <QueryError label="Categories" onRetry={() => void query.refetch()} /> : query.isPending ? <div className="grid grid-cols-3 gap-6 sm:grid-cols-5 lg:grid-cols-9">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}</div> : !roots.length ? <EmptyState title="The catalog is taking shape" description="Explore the products currently available." action={<Link href="/products" className="btn-secondary">Explore products</Link>} /> : <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 lg:grid-cols-9">{roots.map(category => <Link key={category._id} href={`/categories/${category.slug}`} className="home-category text-center"><div className="home-category-photo">{category.image ? <ProductImage src={category.image} alt="" sizes="132px" className="p-3" /> : <span className="flex h-full items-center justify-center text-[#7C8296]"><CategoryIcon name={category.name} size={32} /></span>}</div><h3 className="mt-3 text-sm leading-snug">{category.name}</h3>{category.productCount !== undefined && <p className="mt-1 text-xs text-muted">{category.productCount} {category.productCount === 1 ? 'find' : 'finds'}</p>}</Link>)}</div>}
  </section>;
}

export function HomeMoreProducts({ products, arrivals }: { products?: Product[]; arrivals?: ApiResponse<Product[]> }) {
  const [tab, setTab] = useState('curated');
  const featured = useQuery({ ...featuredQueryOptions, initialData: products });
  const newest = useQuery({ ...arrivalsQueryOptions, initialData: arrivals });
  const budget = useQuery({ queryKey: ['storefront', 'budget-edit'], queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products?maxPrice=1999&limit=8', { signal }).then(response => response.data.data ?? []), enabled: tab === 'budget', staleTime: 60_000 });
  const selected = tab === 'curated' ? featured : tab === 'new' ? { ...newest, data: newest.data?.data } : budget;
  const items = selected.data?.slice(0, 8) ?? [];
  const href = tab === 'curated' ? '/products?featured=true' : tab === 'budget' ? '/products?maxPrice=1999' : '/products';
  return <section id="the-edit" className="border-y border-[var(--border)] bg-white/55"><div className="page-container section">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-2">Worth a closer look</p><h2 className="section-heading">The everyday edit.</h2><p className="mt-2 text-sm text-muted">Good finds for the way you work, live, and unwind.</p></div><Link href={href} className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary">View the collection<ArrowRight size={17} aria-hidden /></Link></div>
    <Tabs.Root value={tab} onValueChange={setTab}><Tabs.List aria-label="Product collections" className="mb-7 flex gap-2 overflow-x-auto"><Tabs.Trigger value="curated" className="collection-tab">Curated picks</Tabs.Trigger><Tabs.Trigger value="new" className="collection-tab">New to the catalog</Tabs.Trigger><Tabs.Trigger value="budget" className="collection-tab">Under ₹1,999</Tabs.Trigger></Tabs.List>
      {['curated', 'new', 'budget'].map(value => <Tabs.Content key={value} value={value}>
        {selected.isError ? <QueryError label="This collection" onRetry={() => void selected.refetch()} /> : selected.isPending ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}</div> : !items.length ? <EmptyState title="More finds are on their way" description="Explore another collection or browse the full catalog." action={<Link href="/products" className="btn-secondary">All products</Link>} /> : <><div className="product-grid">{items.map(product => <ProductCard key={product._id} product={product} />)}</div>{items.some(product => product.isDemo) && <p className="mt-5 text-xs text-muted">Items marked Sample are here for discovery. Their prices are illustrative and they are not available to buy.</p>}</>}
      </Tabs.Content>)}
    </Tabs.Root>
  </div></section>;
}

export function HomeEditorial({ categories }: { categories?: Category[] }) {
  const query = useQuery({ ...categoryQueryOptions, initialData: categories });
  const edits = [{ slug: 'home', eyebrow: 'Make space for you', title: 'Little changes.\nA lovely difference.', link: 'Explore home & living' }, { slug: 'electronics', eyebrow: 'Switch into your flow', title: 'Your day,\nbeautifully upgraded.', link: 'Discover everyday tech' }];
  return <section className="page-container section" aria-label="Shop the collections"><div className="grid gap-5 md:grid-cols-2">{edits.map(edit => {
    const category = query.data?.find(item => item.slug === edit.slug);
    return <article key={edit.slug} className="editorial-card"><div className="relative z-10 flex max-w-[65%] flex-col items-start p-6 sm:p-8"><p className="eyebrow text-orange-600">{edit.eyebrow}</p><h2 className="mt-4 whitespace-pre-line text-2xl leading-tight sm:text-3xl">{edit.title}</h2><Link href={`/categories/${edit.slug}`} className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm text-secondary">{edit.link}<ArrowUpRight size={17} aria-hidden /></Link></div><div className="absolute bottom-0 right-0 top-0 w-[43%]">{category?.image ? <ProductImage src={category.image} alt="" sizes="300px" className="p-3" /> : <div className="flex h-full items-center justify-center text-[#B9BECF]"><Grid2X2 size={72} strokeWidth={1} aria-hidden /></div>}</div></article>;
  })}</div></section>;
}
