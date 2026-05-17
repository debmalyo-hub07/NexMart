'use client';

import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { LiveSyncBadge } from '@/components/common/LiveSyncBadge';
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

  const openSidebar  = useCallback(() => setMobileSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/admin/login') || pathname?.startsWith('/admin/register');

  if (isAuthPage) {
    return <div className="min-h-screen bg-space-900">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-space-900 flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-white/5 bg-space-900/80 backdrop-blur-sm sticky top-0 z-30">
          <button
            onClick={openSidebar}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60"
            suppressHydrationWarning
          >
            <Menu size={20} />
          </button>
          <span className="font-syne font-bold gradient-text flex-1">Admin Panel</span>
          <LiveSyncBadge />
        </div>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
