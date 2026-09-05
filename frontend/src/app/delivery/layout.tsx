'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LiveSyncBadge } from '@/components/common/LiveSyncBadge';
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
    <div className="min-h-screen bg-space-900 flex flex-col">
      {/* Persistent Header */}
      <div className="glass border-b border-white/5 sticky top-0 z-10">
        <div className="page-container flex items-center gap-3 h-[64px]">
          <Link href="/delivery/dashboard" className="shrink-0 transition-transform hover:scale-105">
            <Logo size={30} />
          </Link>
          <div className="flex-1">
            <h1 className="font-syne text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 leading-none">
              {pathname?.includes('/profile') ? 'Agent Profile' : 'Delivery Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LiveSyncBadge />
            <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
            <Link href="/delivery/profile" className="flex items-center gap-2 p-2 sm:p-0 rounded-xl hover:bg-white/5 sm:hover:bg-transparent text-white/60 hover:text-white transition-colors">
              <User size={18} />
              <span className="text-sm font-medium hidden sm:block">Profile</span>
            </Link>
            <button onClick={() => logout()} className="flex items-center gap-2 p-2 sm:p-0 rounded-xl hover:bg-red-500/10 sm:hover:bg-transparent text-red-400/60 hover:text-red-400 transition-colors ml-1 sm:ml-0">
              <LogOut size={18} />
              <span className="text-sm font-medium hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}
