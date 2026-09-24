'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { arrivalsQueryOptions, categoryQueryOptions, featuredQueryOptions, rootCategories } from '@/lib/catalog';
import api from '@/lib/api';
import type { ApiResponse, Category, Product } from '@/types';
import { CollectionImage } from '@/components/product/CollectionImage';
import { ProductCard } from '@/components/product/ProductCard';
import { Reveal } from '@/components/common/Reveal';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { ProductCardSkeleton, Skeleton } from '@/components/common/SkeletonLoader';

export function HomeCategories({ categories }: { categories?: Category[] }) {
  const query = useQuery({ ...categoryQueryOptions, initialData: categories });
  const roots = rootCategories(query.data ?? []);
  return <section className="page-container department-section" aria-labelledby="home-categories"><h2 id="home-categories" className="sr-only">Shop by category</h2>
    {query.isError ? <QueryError label="Categories" onRetry={() => void query.refetch()} /> : query.isPending ? <div className="department-rail">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : !roots.length ? <Link className="btn-secondary" href="/products">Explore the catalog <ArrowRight size={16} aria-hidden /></Link> : <nav className="department-rail" aria-label="Browse departments">{roots.map(category => <Link key={category._id} href={`/categories/${category.slug}`} className="home-category"><div className="home-category-photo"><CollectionImage category={category} sizes="(max-width: 639px) 80px, 112px" /></div><span>{category.name}</span></Link>)}</nav>}
  </section>;
}

export function HomeMoreProducts({ products, arrivals }: { products?: Product[]; arrivals?: ApiResponse<Product[]> }) {
  const [tab, setTab] = useState('curated');
  const featured = useQuery({ ...featuredQueryOptions, initialData: products });
  const newest = useQuery({ ...arrivalsQueryOptions, initialData: arrivals });
  const budget = useQuery({ queryKey: ['storefront', 'budget-edit'], queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products?maxPrice=1999&limit=8', { signal }).then(response => response.data.data ?? []), enabled: tab === 'budget', staleTime: 60000 });
  const selected = tab === 'curated' ? featured : tab === 'new' ? { ...newest, data: newest.data?.data } : budget;
  const items = selected.data?.slice(0, 8) ?? [];
  const href = tab === 'curated' ? '/products?featured=true' : tab === 'budget' ? '/products?maxPrice=1999' : '/products';
  return <section id="the-edit" className="page-container section" aria-labelledby="everyday-edit">
    <div className="section-title-row"><div><p className="eyebrow">DISCOVER SOMETHING GOOD</p><h2 id="everyday-edit" className="section-heading">Good finds for your everyday.</h2><p className="text-sm text-secondary">For the way you live, work, and unwind.</p></div><Link href={href} className="text-link">Shop all <ArrowRight size={17} aria-hidden /></Link></div>
    <Tabs.Root value={tab} onValueChange={setTab}><div className="collection-navigation"><Tabs.List aria-label="Product collections" className="flex gap-1 overflow-x-auto"><Tabs.Trigger value="curated" className="collection-tab">The curated edit</Tabs.Trigger><Tabs.Trigger value="new" className="collection-tab">Just added</Tabs.Trigger><Tabs.Trigger value="budget" className="collection-tab">Under ₹1,999</Tabs.Trigger></Tabs.List><Link href="/budget" className="text-link desktop-budget-link">Shop your budget <ArrowUpRight size={15} aria-hidden /></Link></div>
      {['curated', 'new', 'budget'].map(value => <Tabs.Content key={value} value={value}>
        {selected.isError ? <QueryError label="This collection" onRetry={() => void selected.refetch()} /> : selected.isPending ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}</div> : !items.length ? <EmptyState title="More finds are on their way" description="Explore another collection or browse the full catalog." action={<Link href="/products" className="btn-secondary">All products</Link>} /> : <div className="product-grid">{items.map(product => <ProductCard key={product._id} product={product} />)}</div>}
      </Tabs.Content>)}
    </Tabs.Root>
  </section>;
}

export function HomeEditorial() {
  return <section className="page-container" aria-labelledby="shop-your-way"><div className="section-title-row"><div><p className="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="shop-your-way" className="section-heading">A little more you.</h2></div><Link href="/categories" className="text-link">Every department <ArrowRight size={17} aria-hidden /></Link></div><div className="editorial-grid">
    {[{ slug: 'fashion', photo: 'fashion', kicker: 'WEAR YOUR MOOD', title: 'Everyday looks. Your own spin.', link: 'Find your style' }, { slug: 'beauty', photo: 'beauty', kicker: 'YOUR DAILY RITUAL', title: 'Make a little time for yourself.', link: 'Explore beauty' }, { slug: 'books', photo: 'books', kicker: 'TURN A NEW PAGE', title: 'Your next favourite escape.', link: 'Find a good read' }].map((edit, index) => <Reveal key={edit.slug} delay={index * 90}><Link href={`/categories/${edit.slug}`} className="editorial-story group"><div className="editorial-photo"><Image src={`/images/collections/${edit.photo}.webp`} alt="" fill sizes="(max-width: 639px) 80vw, 430px" className="object-cover transition-transform duration-500 group-hover:scale-105" /></div><div className="editorial-copy"><p className="eyebrow">{edit.kicker}</p><h3>{edit.title}</h3><span className="text-link">{edit.link}<ArrowUpRight size={17} aria-hidden /></span></div></Link></Reveal>)}
  </div></section>;
}
