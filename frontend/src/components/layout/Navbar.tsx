'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ArrowUpRight, ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, ShoppingCart, SlidersHorizontal, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { Logo } from '@/components/common/Logo';
import { Overlay } from '@/components/common/Overlay';
import { ConnectivityNotice } from '@/components/common/ConnectivityNotice';
import { QueryError } from '@/components/common/QueryError';
import { CollectionImage } from '@/components/product/CollectionImage';
import { CartDrawer } from '@/components/navbar/CartDrawer';
import { SearchBar } from '@/components/navbar/SearchBar';
import { MegaMenu } from '@/components/navbar/MegaMenu';
import { categoryQueryOptions, rootCategories, parentId } from '@/lib/catalog';
import { CartSync } from '@/components/cart/CartSync';

const links = [{ href: '/products', label: 'Explore all products' }, { href: '/categories', label: 'Shop by department' }, { href: '/planner', label: 'Your shopping planner' }, { href: '/budget', label: 'Find your budget' }, { href: '/help', label: 'Help & support' }, { href: '/seller/register', label: 'Sell on NexMart' }];
const menuItem = 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-secondary outline-none data-[highlighted]:bg-[var(--bg-raised)] data-[highlighted]:text-[var(--text-primary)]';

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
    : [{ href: '/orders', label: 'Orders & tracking', Icon: Package }, { href: '/wishlist', label: 'Your wishlist', Icon: Heart }, { href: '/profile', label: 'Account & addresses', Icon: User }];

  return <>
    <CartSync />
    <a href="#main-content" className="fixed left-4 top-2 z-[150] -translate-y-24 rounded-lg bg-[var(--brand)] px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
    <header className="storefront-header">
      <div className="utility-bar hidden md:block"><div className="page-container utility-inner"><p>Good finds. Clear prices. A little more you.</p><nav aria-label="Useful links"><Link href="/shipping">Delivery & returns</Link><Link href="/help">Help & support</Link><Link href="/seller/register">Sell on NexMart ↗</Link><span>India · INR ₹</span></nav></div></div>
      <nav className="page-container flex h-16 items-center gap-2 md:h-[72px] md:gap-6" aria-label="Main navigation">
        <button type="button" className="icon-button -ml-2 lg:hidden" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={22} aria-hidden /></button>
        <Link href={admin ? '/admin' : '/'} aria-label="NexMart home" className="brand-wordmark mr-auto shrink-0 md:mr-2"><Logo size={34} />NexMart<small>.</small></Link>
        <div className="hidden min-w-0 flex-1 md:block"><SearchBar /></div>
        <div className="flex shrink-0 items-center gap-1 lg:gap-2">
          {!admin && <Link href="/orders" className="header-action header-orders"><Package size={21} aria-hidden /><span><small>Your purchases</small><strong>Orders</strong></span></Link>}
          {mounted && authenticated ? <Dropdown.Root><Dropdown.Trigger asChild><button type="button" className="header-action" aria-label="Account menu"><User size={21} aria-hidden /><span className="hidden lg:block"><small>Hello, {user?.name?.split(' ')[0]}</small><strong>Your account</strong></span><ChevronDown size={12} className="hidden lg:block" aria-hidden /></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="z-[80] w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-xl" align="end" sideOffset={8} collisionPadding={16}>
            <Dropdown.Label className="break-words border-b border-[var(--border)] px-3 py-3 text-sm font-semibold">{user?.name}</Dropdown.Label>
            {accountLinks.map(({ href, label, Icon }) => <Dropdown.Item key={href} asChild><Link href={href} className={menuItem}><Icon size={17} aria-hidden />{label}</Link></Dropdown.Item>)}
            <Dropdown.Separator className="my-1 h-px bg-[var(--border)]" /><Dropdown.Item asChild><button type="button" className={`${menuItem} w-full text-red-700`} onClick={() => void logout()}><LogOut size={17} aria-hidden />Sign out</button></Dropdown.Item>
          </Dropdown.Content></Dropdown.Portal></Dropdown.Root> : <Link href="/customer/login" className="header-action" aria-label="Sign in"><User size={21} aria-hidden /><span className="hidden lg:block"><small>Hello there</small><strong>Sign in</strong></span></Link>}
          {!admin && <button type="button" className="header-action" aria-label={`Open cart${mounted && count ? `, ${count} items` : ''}`} onClick={() => setCartOpen(true)}><ShoppingCart size={23} aria-hidden /><strong className="hidden lg:inline">Cart</strong><span className="cart-count">{mounted ? count > 99 ? '99+' : count : 0}</span></button>}
        </div>
      </nav>
      <div className="page-container h-[54px] pb-2 md:hidden"><SearchBar /></div>
      <div className="category-bar hidden lg:block"><nav className="page-container flex h-11 items-center gap-5" aria-label="Shop departments">
        <MegaMenu categories={categories.data ?? []} />
        <Link href="/products" className="department-link border-l border-[var(--border)] pl-5" aria-current={pathname === '/products' ? 'page' : undefined}>All products</Link>
        <div className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto no-scrollbar">{roots.slice(0, 6).map(category => <Link key={category._id} href={`/categories/${category.slug}`} aria-current={pathname === `/categories/${category.slug}` ? 'page' : undefined} className="department-link">{category.name}</Link>)}</div>
        <Link href="/planner" className="nav-planner"><SlidersHorizontal size={14} aria-hidden />Your shopping planner <ArrowUpRight size={14} aria-hidden /></Link>
      </nav></div>
    </header>
    <div className="relative top-[var(--navbar-height)] z-40"><ConnectivityNotice /></div>
    <Overlay open={navOpen} onClose={() => setNavOpen(false)} title="Explore NexMart" variant="drawer-left">
      <nav aria-label="Mobile navigation" className="space-y-5">
        <div>{links.map(link => <Link key={link.href} href={link.href} onClick={() => setNavOpen(false)} className="nav-item">{link.label}<ArrowUpRight size={15} className="ml-auto" aria-hidden /></Link>)}</div>
        <div className="border-t border-[var(--border)] pt-4"><p className="eyebrow mb-2">Shop departments</p>{categories.isError ? <QueryError label="Categories" onRetry={() => void categories.refetch()} /> : categories.isPending ? <p role="status" className="px-4 text-sm text-muted">Loading categories…</p> : roots.map(category => <details key={category._id} className="border-b border-[var(--border)]"><summary className="flex min-h-16 cursor-pointer items-center gap-3 text-sm"><span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md"><CollectionImage category={category} sizes="44px" /></span>{category.name}<ChevronDown size={15} className="ml-auto" aria-hidden /></summary><Link href={`/categories/${category.slug}`} className="nav-item" onClick={() => setNavOpen(false)}>Explore all {category.name}</Link>{(categories.data ?? []).filter(child => parentId(child) === category._id).map(child => <Link key={child._id} href={`/categories/${child.slug}`} className="nav-item text-xs" onClick={() => setNavOpen(false)}>{child.name}</Link>)}</details>)}</div>
        <div className="border-t border-[var(--border)] pt-4"><p className="eyebrow mb-2">Your account</p>{mounted && authenticated ? <>{accountLinks.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setNavOpen(false)} className="nav-item"><Icon size={18} aria-hidden />{label}</Link>)}<button type="button" className="nav-item w-full text-red-700" onClick={() => { setNavOpen(false); void logout(); }}><LogOut size={18} aria-hidden />Sign out</button></> : <Link href="/customer/login" className="btn-primary w-full" onClick={() => setNavOpen(false)}>Sign in to your account</Link>}</div>
      </nav>
    </Overlay>
    {!admin && <CartDrawer />}
  </>;
}
