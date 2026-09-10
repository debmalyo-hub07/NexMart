'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, User, Menu, X, ChevronDown, LogOut, LayoutDashboard, Package, Truck, Home, Tag } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/common/Logo';
import { useUIStore } from '@/store/uiStore';
import { useDrawerBehavior } from '@/hooks/useDrawerBehavior';
import { useQuery } from '@tanstack/react-query';
import { CartDrawer } from '@/components/navbar/CartDrawer';
import { SearchBar } from '@/components/navbar/SearchBar';
import { MegaMenu } from '@/components/navbar/MegaMenu';
import { cn, getInitials } from '@/lib/utils';
import Image from 'next/image';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const PRIMARY_LINKS = [
  { label: 'Home',     href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Deals',    href: '/products?tag=deal' },
  { label: 'About',    href: '/about' },
];

// Stable animation variants — defined at module level to prevent re-creation on render
const mobileNavVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
  exit: { x: '-100%' },
};
const mobileNavTransition = { type: 'spring' as const, damping: 25, stiffness: 200 };
const userMenuVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.95 },
};
const userMenuTransition = { duration: 0.15 };
const cartBadgeVariants = { hidden: { scale: 0 }, visible: { scale: 1 }, exit: { scale: 0 } };
const chevronTransition = { duration: 0.2 };

export const Navbar = memo(function Navbar() {
  const { itemCount, setOpen } = useCartStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { setSearchOpen, isSearchOpen } = useUIStore();
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const { data: categories = [] } = useQuery({
    queryKey: ['mega-menu-categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      const data = res.data.data;
      const parents = data.filter((c: any) => !c.parent).sort((a: any, b: any) => a.displayOrder - b.displayOrder);
      return parents.map((p: any) => {
        const subs = data.filter((c: any) => c.parent?._id === p._id).sort((a: any, b: any) => a.displayOrder - b.displayOrder);
        return {
          name: p.name,
          slug: p.slug,
          icon: p.icon || '📦',
          sub: subs.map((s: any) => s.name)
        };
      });
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const count = itemCount();

  // Mobile drawer modal behavior (scroll lock + Escape) — shared hook, same
  // contract as the admin sidebar drawer.
  useDrawerBehavior(mobileNavOpen, () => setMobileNavOpen(false));

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(e.target as Node)) {
        setMegaMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Stable callbacks
  const openCart = useCallback(() => setOpen(true), [setOpen]);
  const toggleSearch = useCallback(() => setSearchOpen(!isSearchOpen), [setSearchOpen, isSearchOpen]);
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen]);
  const openMegaMenu = useCallback(() => setMegaMenuOpen(true), []);
  const closeMegaMenu = useCallback(() => setMegaMenuOpen(false), []);
  const toggleUserMenu = useCallback(() => setUserMenuOpen((v) => !v), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const handleLogout = useCallback(() => { void logout(); setUserMenuOpen(false); }, [logout]);

  const headerClass = useMemo(() => cn(
    'fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-space-900/85 backdrop-blur-md',
  ), []);

  return (
    <>
      <header className={headerClass}>
        <nav className="page-container">
          <div className="flex items-center justify-between h-[var(--navbar-height)] gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <Logo size={30} className="shrink-0" />
              <span className="font-syne font-bold text-xl hidden sm:block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">NexMart</span>
            </Link>

            {/* Primary nav links + Categories */}
            <div className="hidden lg:flex items-center gap-1">
              {PRIMARY_LINKS.map(({ label, href }) => {
                const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onMouseEnter={() => router.prefetch(href)}
                    className={cn(
                      'relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'text-white bg-white/[0.08]'
                        : 'text-white/60 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-full bg-white/[0.08] -z-10"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Categories mega menu */}
              <div
                ref={megaMenuRef}
                className="flex items-center relative h-full"
                onMouseEnter={openMegaMenu}
                onMouseLeave={closeMegaMenu}
              >
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200',
                    megaMenuOpen ? 'text-white bg-white/[0.08]' : 'text-white/60 hover:text-white hover:bg-white/5',
                  )}
                  suppressHydrationWarning
                >
                  <span>Categories</span>
                  <motion.span animate={{ rotate: megaMenuOpen ? 180 : 0 }} transition={chevronTransition}>
                    <ChevronDown size={13} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {megaMenuOpen && categories.length > 0 && (
                    <MegaMenu categories={categories} onClose={closeMegaMenu} />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm hidden md:block">
              <SearchBar />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Mobile search */}
              <button
                className="md:hidden p-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                onClick={toggleSearch}
                aria-label={isSearchOpen ? 'Close search' : 'Open search'}
                suppressHydrationWarning
              >
                <Search size={20} />
              </button>

              {/* Cart */}
              <button
                className="relative p-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                onClick={openCart}
                id="cart-btn"
                aria-label={`Open cart${count > 0 ? `, ${count} items` : ''}`}
                suppressHydrationWarning
              >
                <ShoppingCart size={20} />
                <AnimatePresence>
                  {mounted && count > 0 && (
                    <motion.span
                      variants={cartBadgeVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center"
                    >
                      {count > 99 ? '99+' : count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* User */}
              <div ref={userMenuRef} className="relative">
                {!mounted ? (
                  <div className="w-8 h-8 rounded-full bg-transparent" />
                ) : isAuthenticated && user ? (
                  <button
                    onClick={toggleUserMenu}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Open account menu"
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {user.profilePicture ? (
                      <Image src={user.profilePicture} alt={user.name} width={32} height={32} className="rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-sm font-semibold text-violet-300">
                        {getInitials(user.name)}
                      </div>
                    )}
                    <span className="hidden lg:block text-sm text-white/80">{user.name.split(' ')[0]}</span>
                    <ChevronDown size={14} className="hidden lg:block text-white/40" />
                  </button>
                ) : (
                  <Link href="/customer/login" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-[0_0_15px_rgba(167,139,250,0.4)] hover:shadow-[0_0_25px_rgba(167,139,250,0.6)] transition-shadow flex items-center justify-center">
                    Sign In
                  </Link>
                )}

                <AnimatePresence>
                  {userMenuOpen && isAuthenticated && (
                    <motion.div
                      variants={userMenuVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={userMenuTransition}
                      className="absolute right-0 top-full mt-2 w-56 glass rounded-2xl p-2 border border-white/[0.08] shadow-glow-violet"
                    >
                      <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <p className="text-sm font-semibold text-white">{user?.name}</p>
                        <p className="text-xs text-white/40">{user?.email}</p>
                      </div>

                      {user?.role === 'admin' && (
                        <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" onClick={() => setUserMenuOpen(false)}>
                          <LayoutDashboard size={16} />Admin Dashboard
                        </Link>
                      )}
                      {user?.role === 'agent' && (
                        <Link href="/delivery/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Truck size={16} />My Deliveries
                        </Link>
                      )}
                      <Link href="/orders" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                        <Package size={16} />My Orders
                      </Link>
                      
                      {user?.role === 'agent' ? (
                        <Link href="/delivery/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <User size={16} />Agent Profile
                        </Link>
                      ) : (
                        <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <User size={16} />Profile
                        </Link>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        suppressHydrationWarning
                      >
                        <LogOut size={16} />Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                onClick={toggleMobileNav}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-navigation"
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                suppressHydrationWarning
              >
                {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile search bar */}
        {isSearchOpen && (
          <div className="search-panel md:hidden px-4 pb-3">
            <SearchBar autoFocus onClose={closeSearch} />
          </div>
        )}
      </header>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={closeMobileNav}
            />
            <motion.div
              variants={mobileNavVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={mobileNavTransition}
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className="fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(20rem,calc(100vw-1rem))] flex-col border-r border-white/5 bg-space-900/95 backdrop-blur-xl lg:hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <span className="flex items-center gap-2.5">
                  <Logo size={26} />
                  <span className="font-syne font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">NexMart</span>
                </span>
                <button onClick={closeMobileNav} className="p-2 rounded-lg hover:bg-white/5" suppressHydrationWarning>
                  <X size={20} className="text-white/70" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {/* Primary links */}
                <p className="text-[10px] uppercase tracking-widest text-white/25 px-4 pb-1 pt-2">Navigation</p>
                {PRIMARY_LINKS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      pathname === href ? 'text-white bg-white/[0.08]' : 'text-white/60 hover:text-white hover:bg-white/5',
                    )}
                    onClick={closeMobileNav}
                  >
                    {label}
                  </Link>
                ))}

                {/* Category links */}
                {categories.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-white/25 px-4 pb-1 pt-4">Categories</p>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.slug}
                        href={`/categories/${cat.slug}`}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        onClick={closeMobileNav}
                      >
                        <span>{cat.icon}</span>
                        <span className="font-medium">{cat.name}</span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <CartDrawer />
    </>
  );
});
