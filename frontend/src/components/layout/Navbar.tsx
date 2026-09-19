'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, ShoppingBag, Truck, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { Logo } from '@/components/common/Logo';
import { Overlay } from '@/components/common/Overlay';
import { ConnectivityNotice } from '@/components/common/ConnectivityNotice';
import { QueryError } from '@/components/common/QueryError';
import { CategoryIcon } from '@/components/product/CategoryIcon';
import { CartDrawer } from '@/components/navbar/CartDrawer';
import { SearchBar } from '@/components/navbar/SearchBar';
import { MegaMenu } from '@/components/navbar/MegaMenu';
import { categoryQueryOptions, rootCategories, parentId } from '@/lib/catalog';
import { cn } from '@/lib/utils';
import { CartSync } from '@/components/cart/CartSync';

const links = [{ href: '/products', label: 'All products' }, { href: '/categories', label: 'All categories' }, { href: '/about', label: 'Our story' }, { href: '/help', label: 'Shopping help' }];
const menuItem = 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-secondary outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white';

export function Navbar() {
  const pathname = usePathname();
  const user = useAuthStore(store => store.user);
  const authenticated = useAuthStore(store => store.isAuthenticated);
  const logout = useAuthStore(store => store.logout);
  const count = useCartStore(store => store.items.reduce((total, item) => total + item.quantity, 0));
  const setCartOpen = useCartStore(store => store.setOpen);
  const [mounted, setMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const categories = useQuery(categoryQueryOptions);
  const roots = rootCategories(categories.data ?? []);
  const admin = mounted && authenticated && user?.role === 'admin';
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setNavOpen(false); }, [pathname]);
  const accountLinks = admin
    ? [{ href: '/admin', label: 'Store dashboard', Icon: LayoutDashboard }, { href: '/admin/profile', label: 'Admin profile', Icon: User }]
    : [{ href: '/orders', label: 'Orders & tracking', Icon: Package }, { href: '/wishlist', label: 'Saved products', Icon: Heart }, { href: '/profile', label: 'Profile & addresses', Icon: User }];

  return <>
    <CartSync />
    <a href="#main-content" className="fixed left-4 top-2 z-[150] -translate-y-24 rounded-lg bg-violet-600 px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
    <header className="fixed inset-x-0 top-0 z-50 bg-space-900">
      <div className="utility-bar hidden md:block"><div className="page-container flex h-7 items-center justify-between text-xs text-secondary"><p className="flex items-center gap-2"><Truck size={13} aria-hidden />Free delivery on item subtotals over ₹999</p><div className="flex items-center gap-6"><Link href="/about" className="hover:text-white">Our story</Link><Link href="/orders" className="hover:text-white">Track an order</Link><Link href="/help" className="hover:text-white">Help & support</Link><span className="text-muted">India · INR ₹</span></div></div></div>
      <nav className="page-container flex h-16 items-center gap-2 md:h-[72px] md:gap-6" aria-label="Main navigation">
        <button type="button" className="icon-button -ml-2 lg:hidden" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={21} aria-hidden /></button>
        <Link href={admin ? '/admin' : '/'} aria-label="NexMart home" className="mr-auto flex min-h-11 shrink-0 items-center gap-2 md:mr-3"><Logo size={30} /><span className="font-outfit text-2xl font-semibold tracking-tight">NexMart<span className="text-violet-300">.</span></span></Link>
        <div className="hidden min-w-0 flex-1 md:block"><SearchBar /></div>
        <div className="flex shrink-0 items-center gap-1 md:gap-3">
          {!admin && <Link href="/wishlist" aria-label="Saved products" className="icon-button hidden lg:flex"><Heart size={21} aria-hidden /></Link>}
          {mounted && authenticated ? <Dropdown.Root><Dropdown.Trigger asChild><button type="button" className="icon-button gap-2 px-2" aria-label="Account menu"><User size={21} aria-hidden /><span className="hidden text-sm xl:inline">Account</span><ChevronDown size={12} className="hidden xl:block" aria-hidden /></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="z-[80] w-64 rounded-xl border border-white/25 bg-space-800 p-2" align="end" sideOffset={8} collisionPadding={16}>
            <Dropdown.Label className="break-words border-b border-white/15 px-3 py-3 text-sm font-semibold">{user?.name}</Dropdown.Label>
            {accountLinks.map(({ href, label, Icon }) => <Dropdown.Item key={href} asChild><Link href={href} className={menuItem}><Icon size={17} aria-hidden />{label}</Link></Dropdown.Item>)}
            <Dropdown.Separator className="my-1 h-px bg-white/15" /><Dropdown.Item asChild><button type="button" className={`${menuItem} w-full text-red-300`} onClick={() => void logout()}><LogOut size={17} aria-hidden />Sign out</button></Dropdown.Item>
          </Dropdown.Content></Dropdown.Portal></Dropdown.Root> : <Link href="/customer/login" className="icon-button gap-2 px-2" aria-label="Sign in"><User size={21} aria-hidden /><span className="hidden text-sm lg:inline">Sign in</span></Link>}
          {!admin && <button type="button" className="icon-button relative gap-2 px-2" aria-label={`Open cart${mounted && count ? `, ${count} items` : ''}`} onClick={() => setCartOpen(true)}><ShoppingBag size={21} aria-hidden /><span className="hidden text-sm xl:inline">Bag</span>{mounted && count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">{count > 99 ? '99+' : count}</span>}</button>}
        </div>
      </nav>
      <div className="page-container h-[54px] pb-2 md:hidden"><SearchBar /></div>
      <div className="category-bar hidden lg:block"><nav className="page-container flex h-11 items-center gap-5" aria-label="Shop departments">
        <MegaMenu categories={categories.data ?? []} />
        <Link href="/products" className={cn('border-l border-white/20 pl-5 text-sm', pathname === '/products' ? 'text-violet-200' : 'text-secondary')}>All products</Link>
        <div className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto no-scrollbar">{roots.slice(0, 6).map(category => <Link key={category._id} href={`/categories/${category.slug}`} aria-current={pathname === `/categories/${category.slug}` ? 'page' : undefined} className="text-xs text-secondary transition-colors hover:text-white">{category.name}</Link>)}</div>
        <Link href="/products?featured=true" className="shrink-0 text-xs font-medium text-violet-200">The curated edit ↗</Link>
      </nav></div>
    </header>
    <div className="relative top-[var(--navbar-height)] z-40"><ConnectivityNotice /></div>
    <Overlay open={navOpen} onClose={() => setNavOpen(false)} title="Explore NexMart" variant="drawer-left">
      <nav aria-label="Mobile navigation" className="space-y-5">
        <div>{links.map(link => <Link key={link.href} href={link.href} onClick={() => setNavOpen(false)} className="nav-item">{link.label}</Link>)}</div>
        <div className="border-t border-white/15 pt-4"><p className="eyebrow mb-2 px-4">Shop departments</p>{categories.isError ? <QueryError label="Categories" onRetry={() => void categories.refetch()} /> : categories.isPending ? <p role="status" className="px-4 text-sm text-muted">Loading categories…</p> : roots.map(category => <details key={category._id} className="border-b border-white/10"><summary className="flex min-h-12 cursor-pointer items-center gap-3 text-sm"><CategoryIcon name={category.name} size={19} />{category.name}<ChevronDown size={15} className="ml-auto" aria-hidden /></summary><Link href={`/categories/${category.slug}`} className="nav-item" onClick={() => setNavOpen(false)}>Explore all {category.name}</Link>{(categories.data ?? []).filter(child => parentId(child) === category._id).map(child => <Link key={child._id} href={`/categories/${child.slug}`} className="nav-item text-xs" onClick={() => setNavOpen(false)}>{child.name}</Link>)}</details>)}</div>
        <div className="border-t border-white/15 pt-4"><p className="eyebrow mb-2 px-4">Your account</p>{mounted && authenticated ? <>{accountLinks.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setNavOpen(false)} className="nav-item"><Icon size={18} aria-hidden />{label}</Link>)}<button type="button" className="nav-item w-full text-red-300" onClick={() => { setNavOpen(false); void logout(); }}><LogOut size={18} aria-hidden />Sign out</button></> : <Link href="/customer/login" className="btn-primary w-full" onClick={() => setNavOpen(false)}>Sign in to your account</Link>}</div>
      </nav>
    </Overlay>
    {!admin && <CartDrawer />}
  </>;
}
