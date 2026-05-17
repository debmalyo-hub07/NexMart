'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, Users, Truck,
  BarChart3, LogOut, X, ChevronRight, FolderTree, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useSession } from 'next-auth/react';
import { LiveSyncBadge } from '@/components/common/LiveSyncBadge';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',  href: '/admin' },
  { icon: Package,         label: 'Products',   href: '/admin/products' },
  { icon: FolderTree,      label: 'Categories', href: '/admin/categories' },
  { icon: ShoppingBag,     label: 'Orders',     href: '/admin/orders' },
  { icon: Users,           label: 'Customers',  href: '/admin/users' },
  { icon: Truck,           label: 'Delivery',   href: '/admin/delivery' },
  { icon: BarChart3,       label: 'Analytics',  href: '/admin/analytics' },
  { icon: User,            label: 'Profile',    href: '/admin/profile' },
];

interface AdminSidebarProps {
  onClose?: () => void;
}

export const AdminSidebar = memo(function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = useCallback(() => { void logout(); }, [logout]);

  // Use session as the ground truth — it's populated by NextAuth on load
  // and is more reliable than the Zustand store during hydration/logout flash.
  const displayName  = mounted ? (user?.name  || session?.user?.name  || '') : '';
  const displayEmail = mounted ? (user?.email || session?.user?.email || '') : '';

  // Build initials from the display name — never fall back to '??' or 'N'
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <aside className="flex flex-col h-full w-[260px] bg-space-900/95 backdrop-blur-xl border-r border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-gradient flex items-center justify-center">
            <span className="text-white font-bold text-xs">N</span>
          </div>
          <span className="font-syne font-bold text-lg gradient-text">NexMart</span>
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <LiveSyncBadge />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
              suppressHydrationWarning
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-white bg-violet-600/20 border border-violet-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/6',
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
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/5 mb-2">
          {/* Avatar — shows skeleton ring until mounted, then initials */}
          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs font-semibold text-violet-300 shrink-0">
            {mounted ? initials : <span className="w-3 h-3 rounded-full bg-violet-500/40 animate-pulse" />}
          </div>
          <div className="flex-1 min-w-0">
            {mounted ? (
              <>
                <p className="text-sm font-medium text-white truncate leading-tight">
                  {displayName || <span className="text-white/30 italic text-xs">Loading…</span>}
                </p>
                <p className="text-[10px] text-white/40 truncate mt-0.5">
                  {displayEmail}
                </p>
              </>
            ) : (
              <>
                <div className="h-3 w-24 bg-white/10 rounded animate-pulse mb-1.5" />
                <div className="h-2 w-32 bg-white/6 rounded animate-pulse" />
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          suppressHydrationWarning
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
});
