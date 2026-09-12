'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, Search, ShoppingCart, User } from 'lucide-react';
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
import { categoryQueryOptions, rootCategories } from '@/lib/catalog';
import { cn } from '@/lib/utils';
import { CartSync } from '@/components/cart/CartSync';

const links = [{ href: '/products', label: 'Products' }, { href: '/categories', label: 'Categories' }, { href: '/about', label: 'About' }];
const menuItem = 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-secondary outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white';

export function Navbar() {
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const logout = useAuthStore(s => s.logout);
  const count = useCartStore(s => s.items.reduce((total, item) => total + item.quantity, 0));
  const setCartOpen = useCartStore(s => s.setOpen);
  const [mounted, setMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const categories = useQuery(categoryQueryOptions);
  const admin = mounted && isAuthenticated && user?.role === 'admin';
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setNavOpen(false); setSearchOpen(false); }, [pathname]);

  const accountLinks = admin
    ? [{ href: '/admin', label: 'Store dashboard', Icon: LayoutDashboard }, { href: '/admin/profile', label: 'Admin profile', Icon: User }]
    : [{ href: '/orders', label: 'Orders & tracking', Icon: Package }, { href: '/wishlist', label: 'Saved products', Icon: Heart }, { href: '/profile', label: 'Profile & addresses', Icon: User }];

  return <>
    <CartSync />
    <a href="#main-content" className="fixed left-4 top-2 z-[150] -translate-y-24 rounded-lg bg-violet-600 px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-space-900">
      <nav className="page-container flex h-[var(--navbar-height)] items-center gap-2 sm:gap-4" aria-label="Main navigation">
        <Link href={admin ? '/admin' : '/'} aria-label="NexMart home" className="mr-auto flex min-h-11 shrink-0 items-center gap-1.5 lg:mr-2"><Logo size={28} /><span className="font-outfit text-xl font-semibold tracking-tight">NexMart</span></Link>
        <div className="hidden shrink-0 items-center gap-1 lg:flex">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? 'page' : undefined} className={cn('nav-item px-3', pathname.startsWith(link.href) && 'active')}>{link.label}</Link>)}</div>
        <div className="hidden min-w-0 flex-1 md:block"><SearchBar /></div>
        <button type="button" className="icon-button md:hidden" aria-label="Search the catalog" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden /></button>
        {!admin && <button type="button" className="icon-button relative" aria-label={`Open cart${mounted && count ? `, ${count} items` : ''}`} onClick={() => setCartOpen(true)}><ShoppingCart size={20} aria-hidden />{mounted && count > 0 && <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">{count > 99 ? '99+' : count}</span>}</button>}
        <div className="hidden shrink-0 md:block">
          {mounted && isAuthenticated ? <Dropdown.Root><Dropdown.Trigger asChild><button type="button" className="btn-secondary px-3" aria-label="Account menu"><User size={18} aria-hidden /><span className="hidden xl:inline">Account</span><ChevronDown size={14} aria-hidden /></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="z-[80] w-64 rounded-xl border border-white/15 bg-space-800 p-2" align="end" sideOffset={8} collisionPadding={16}>
            <Dropdown.Label className="break-words border-b border-white/10 px-3 py-3 text-sm font-semibold">{user?.name}</Dropdown.Label>
            {accountLinks.map(({ href, label, Icon }) => <Dropdown.Item key={href} asChild><Link href={href} className={menuItem}><Icon size={17} aria-hidden />{label}</Link></Dropdown.Item>)}
            <Dropdown.Separator className="my-1 h-px bg-white/10" /><Dropdown.Item asChild><button type="button" className={`${menuItem} w-full text-red-300`} onClick={() => void logout()}><LogOut size={17} aria-hidden />Sign out</button></Dropdown.Item>
          </Dropdown.Content></Dropdown.Portal></Dropdown.Root> : <Link href="/customer/login" className="btn-secondary px-4">Sign in</Link>}
        </div>
        <button type="button" className="icon-button lg:hidden" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={21} aria-hidden /></button>
      </nav>
    </header>
    <div className="relative top-[var(--navbar-height)] z-40"><ConnectivityNotice /></div>
    <Overlay open={navOpen} onClose={() => setNavOpen(false)} title="Explore NexMart" variant="drawer-left">
      <nav aria-label="Mobile navigation" className="space-y-5">
        <div><Link href="/" onClick={() => setNavOpen(false)} className="nav-item">Home</Link>{links.map(link => <Link key={link.href} href={link.href} onClick={() => setNavOpen(false)} className="nav-item">{link.label}</Link>)}</div>
        <div className="border-t border-white/10 pt-4"><p className="eyebrow mb-2 px-4">Shop by category</p>{categories.isError ? <QueryError label="Categories" onRetry={() => void categories.refetch()} /> : categories.isPending ? <p role="status" className="px-4 text-sm text-muted">Loading categories…</p> : rootCategories(categories.data ?? []).map(category => <Link key={category._id} href={`/categories/${category.slug}`} className="nav-item" onClick={() => setNavOpen(false)}><CategoryIcon name={category.name} size={20} />{category.name}</Link>)}</div>
        <div className="border-t border-white/10 pt-4"><p className="eyebrow mb-2 px-4">Your account</p>{mounted && isAuthenticated ? <>{accountLinks.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setNavOpen(false)} className="nav-item"><Icon size={18} aria-hidden />{label}</Link>)}<button type="button" className="nav-item w-full text-red-300" onClick={() => { setNavOpen(false); void logout(); }}><LogOut size={18} aria-hidden />Sign out</button></> : <Link href="/customer/login" className="btn-primary w-full" onClick={() => setNavOpen(false)}>Sign in to your account</Link>}</div>
      </nav>
    </Overlay>
    <Overlay open={searchOpen} onClose={() => setSearchOpen(false)} title="Search the catalog" variant="drawer" initialFocus="input"><div className="min-h-[55dvh]"><SearchBar onClose={() => setSearchOpen(false)} /></div></Overlay>
    {!admin && <CartDrawer />}
  </>;
}
