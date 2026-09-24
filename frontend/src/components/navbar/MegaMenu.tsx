'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Grid2X2 } from 'lucide-react';
import type { Category } from '@/types';
import { rootCategories, parentId } from '@/lib/catalog';
import { CollectionImage } from '@/components/product/CollectionImage';

export function MegaMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const roots = rootCategories(categories);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button type="button" className="flex min-h-11 shrink-0 items-center gap-2 pr-5 text-sm font-medium"><Grid2X2 size={17} aria-hidden />Browse categories<ChevronDown size={14} aria-hidden /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="z-[80] w-[min(860px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_18px_50px_rgba(15,23,42,.18)]" sideOffset={9} align="start" collisionPadding={24}>
      {roots.length ? <Tabs.Root defaultValue={roots[0].slug} orientation="vertical" className="grid grid-cols-[240px_minmax(0,1fr)]">
        <Tabs.List aria-label="Departments" className="border-r border-[var(--border)] bg-[var(--bg-primary)] p-3">{roots.map(category => <Tabs.Trigger key={category._id} value={category.slug} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-secondary data-[state=active]:bg-[var(--border)] data-[state=active]:font-medium data-[state=active]:text-[var(--accent-violet)]"><span className="relative h-8 w-8 shrink-0 overflow-hidden rounded"><CollectionImage category={category} sizes="32px" /></span>{category.name}</Tabs.Trigger>)}</Tabs.List>
        {roots.map(category => <Tabs.Content key={category._id} value={category.slug} className="p-7">
          <div className="flex gap-5"><div className="flex-1"><p className="eyebrow">Find your next favourite</p><h2 className="mt-2 text-2xl">{category.name}</h2><p className="mt-3 text-sm leading-relaxed text-muted">{category.description}</p></div><div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl"><CollectionImage category={category} sizes="128px" /></div></div>
          <div className="mt-5 grid grid-cols-2 gap-x-4">{categories.filter(child => parentId(child) === category._id).map(child => <Link key={child._id} href={`/categories/${child.slug}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] text-sm text-secondary hover:text-[var(--text-primary)]">{child.name}<span className="text-xs text-muted">{child.productCount ?? ''}</span></Link>)}</div>
          <Link href={`/categories/${category.slug}`} onClick={() => setOpen(false)} className="btn-primary mt-6">Explore {category.name}<ArrowUpRight size={16} aria-hidden /></Link>
        </Tabs.Content>)}
      </Tabs.Root> : <p className="p-6 text-sm text-muted">Categories are loading. <Link href="/categories" onClick={() => setOpen(false)} className="underline">Open category directory</Link></p>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
