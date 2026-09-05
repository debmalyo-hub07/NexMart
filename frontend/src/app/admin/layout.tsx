'use client';

import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { LiveSyncBadge } from '@/components/common/LiveSyncBadge';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/lib/socketEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';
import { Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const drawerVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
};
const drawerTransition = { type: 'spring' as const, damping: 25, stiffness: 200 };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { on } = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  const openSidebar  = useCallback(() => setMobileSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/admin/login') || pathname?.startsWith('/admin/register');

  // Real-time new-order notification: the backend emits 'order:new' to the
  // admin room the moment an order is placed — toast + instant data refresh
  // instead of waiting for the 60s polling backstop.
  useEffect(() => {
    if (isAuthPage) return;
    const unsubscribe = on<{ orderId: string }>(SOCKET_EVENTS.orderNew, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      showToast(`New order received${payload?.orderId ? ` (${payload.orderId})` : ''}`, 'success');
    });
    return unsubscribe;
  }, [on, queryClient, showToast, isAuthPage]);

  if (isAuthPage) {
    return <div className="min-h-screen bg-space-900">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-space-900">
      {/* Desktop sidebar — fixed to the viewport so it keeps a stable height;
          its internal nav scrolls independently if it ever overflows */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 z-30">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={closeSidebar}
            />
            <motion.div
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={drawerTransition}
              className="fixed left-0 top-0 h-full z-50 lg:hidden"
            >
              <AdminSidebar onClose={closeSidebar} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile topbar — sticky within the single document scroll */}
      <div className="lg:hidden flex items-center gap-3 p-4 border-b border-white/5 bg-space-900/80 backdrop-blur-sm sticky top-0 z-30">
        <button
          onClick={openSidebar}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60"
          suppressHydrationWarning
        >
          <Menu size={20} />
        </button>
        <span className="font-syne font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex-1">Admin Panel</span>
        <LiveSyncBadge />
      </div>

      {/* Main content — normal document flow; offset past the fixed sidebar on desktop.
          The page itself is the only scroll container (no nested overflow wrappers). */}
      <main className="p-6 lg:pl-[calc(var(--sidebar-width)+1.5rem)]">
        {children}
      </main>
    </div>
  );
}
