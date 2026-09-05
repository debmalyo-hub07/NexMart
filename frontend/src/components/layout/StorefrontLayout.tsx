'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SmoothScrollProvider } from '@/components/common/SmoothScrollProvider';
import { CustomCursor } from '@/components/common/CustomCursor';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define paths where Navbar/Footer/cursor/smooth-scroll should NOT appear
  const isAuth = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/verify-otp');
  const isAdmin = pathname?.startsWith('/admin');
  const isDelivery = pathname?.startsWith('/delivery');

  const showNavAndFooter = !isAuth && !isAdmin && !isDelivery;

  return (
    <>
      {showNavAndFooter && <Navbar />}
      {showNavAndFooter && <CustomCursor />}
      {showNavAndFooter
        ? <SmoothScrollProvider>{children}</SmoothScrollProvider>
        : children}
      {showNavAndFooter && <Footer />}
    </>
  );
}
