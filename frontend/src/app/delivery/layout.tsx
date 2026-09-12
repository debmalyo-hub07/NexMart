'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LiveSyncBadge } from '@/components/common/LiveSyncBadge';
import { ConnectivityNotice } from '@/components/common/ConnectivityNotice';
import { Logo } from '@/components/common/Logo';
import { User, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const isAuthPage = pathname?.startsWith('/delivery/login') || pathname?.startsWith('/delivery/register');

  if (isAuthPage) {
    return <div className="min-h-screen bg-space-900">{children}</div>;
  }

  return (
    <div className="min-h-[100svh] bg-space-900 flex flex-col">
      {/* Persistent Header */}
      <div className="glass border-b border-white/5 sticky top-0 z-10">
        <div className="page-container flex min-h-16 items-center gap-3 py-2">
          <Link href="/delivery/dashboard" aria-label="Delivery dashboard" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-transform hover:scale-105">
            <Logo size={30} />
          </Link>
          <div className="flex-1">
            <h1 className="font-outfit text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 leading-none">
              {pathname?.includes('/profile') ? 'Agent Profile' : 'Delivery Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LiveSyncBadge />
            <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
            <Link href="/delivery/profile" aria-label="Open delivery profile" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:min-w-0 sm:p-0 sm:hover:bg-transparent">
              <User size={18} aria-hidden />
              <span className="text-sm font-medium hidden sm:block">Profile</span>
            </Link>
            <button type="button" onClick={() => void logout()} aria-label="Sign out of delivery portal" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl p-2 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:min-w-0 sm:p-0 sm:hover:bg-transparent">
              <LogOut size={18} aria-hidden />
              <span className="text-sm font-medium hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Field work happens on patchy mobile networks: the agent must know the
          screen may be stale before acting on it. */}
      <ConnectivityNotice />

      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}
