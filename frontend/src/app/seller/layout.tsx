'use client';

import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { SellerSidebar } from '@/components/seller/SellerSidebar';
import { ConnectivityNotice } from '@/components/common/ConnectivityNotice';
import { useDrawerBehavior } from '@/hooks/useDrawerBehavior';
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

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const openSidebar  = useCallback(() => setMobileSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  useDrawerBehavior(mobileSidebarOpen, closeSidebar);

  const pathname = usePathname();
  const isAuthPage = pathname === '/seller/login' || pathname === '/seller/register' || pathname?.startsWith('/seller/verify-otp');

  if (isAuthPage) {
    return <div className="min-h-screen bg-space-950 text-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-space-950 text-white">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 z-30">
        <SellerSidebar />
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close seller navigation"
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
              id="seller-mobile-sidebar"
              className="fixed left-0 top-0 z-50 h-[100dvh] max-w-[88vw] overscroll-contain lg:hidden"
            >
              <SellerSidebar onClose={closeSidebar} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile topbar */}
      <div className="lg:hidden flex items-center gap-3 p-4 border-b border-white/10 bg-space-900/80 backdrop-blur-sm sticky top-0 z-30">
        <button
          type="button"
          aria-label="Open seller navigation"
          aria-expanded={mobileSidebarOpen}
          aria-controls="seller-mobile-sidebar"
          onClick={openSidebar}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
          suppressHydrationWarning
        >
          <Menu size={20} />
        </button>
        <span className="font-outfit font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex-1">Seller Hub</span>
      </div>

      <div className="lg:pl-[260px]"><ConnectivityNotice /></div>

      <main className="p-4 sm:p-6 lg:pl-[calc(260px+1.5rem)] max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
