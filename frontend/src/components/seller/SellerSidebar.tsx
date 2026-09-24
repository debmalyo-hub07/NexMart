'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Store,
  LogOut, X, ChevronRight, ClipboardCheck, Package, Truck, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/common/Logo';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview',  href: '/seller/dashboard' },
  { icon: Package,         label: 'Listings',  href: '/seller/listings' },
  { icon: ShoppingBag,     label: 'Orders',    href: '/seller/orders' },
  { icon: Truck,           label: 'Shipments', href: '/seller/shipments' },
  { icon: Wallet,          label: 'Finances',  href: '/seller/finances' },
  { icon: ClipboardCheck,  label: 'Store setup', href: '/seller/onboarding' },
];

interface SellerSidebarProps {
  onClose?: () => void;
}

export const SellerSidebar = memo(function SellerSidebar({ onClose }: SellerSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = useCallback(() => { void logout(); }, [logout]);

  const profileQuery = useQuery({
    queryKey: ['seller', 'profile'],
    queryFn: async () => (await api.get('/seller/profile')).data.data,
    enabled: mounted,
  });

  const storefrontName = profileQuery.data?.storefrontName || user?.storefrontName || 'Your store';
  const lifecycleStatus = profileQuery.data?.lifecycleStatus || user?.lifecycleStatus || 'draft';
  const displayEmail = mounted ? (user?.email || '') : '';

  const initials = storefrontName
    ? storefrontName
        .split(' ')
        .filter(Boolean)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <aside className="flex flex-col h-full w-[260px] bg-space-900/95 backdrop-blur-xl border-r border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
        <Link href="/seller/dashboard" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-outfit font-bold text-lg text-[var(--brand)]">NexMart seller</span>
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              suppressHydrationWarning
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || (href !== '/seller/dashboard' && pathname.startsWith(href) && href !== '/seller/onboarding' || (href === '/seller/onboarding' && pathname === href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex min-h-11 items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'text-[var(--brand)] bg-[#EAF0F5] border border-[#CBD8E4]'
                  : 'text-secondary hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/5 mb-2">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs font-semibold text-violet-300 shrink-0">
            {mounted ? (initials || 'S') : <span className="w-3 h-3 rounded-full bg-violet-500/40 animate-pulse" />}
          </div>
          <div className="flex-1 min-w-0">
            {mounted ? (
              <>
                <p className="text-sm font-medium text-white truncate leading-tight">
                  {storefrontName}
                </p>
                <div className="mt-1">
                  <StatusBadge status={lifecycleStatus} />
                </div>
              </>
            ) : (
              <>
                <div className="h-3 w-24 bg-white/10 rounded animate-pulse mb-1.5" />
                <div className="h-2 w-32 bg-white/[0.06] rounded animate-pulse" />
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200"
          suppressHydrationWarning
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
});
