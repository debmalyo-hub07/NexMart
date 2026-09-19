'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CompareTray } from '@/components/product/CompareTray';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define paths where Navbar/Footer/cursor/smooth-scroll should NOT appear
  const isAuth = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/verify-otp');
  const isAdmin = pathname?.startsWith('/admin');
  const isDelivery = pathname?.startsWith('/delivery');
  const isSeller = pathname === '/seller' || pathname?.startsWith('/seller/');

  const showNavAndFooter = !isAuth && !isAdmin && !isDelivery && !isSeller;
  const browseRoute = pathname === '/' || ['/products', '/categories', '/search', '/wishlist'].some(route => pathname === route || pathname?.startsWith(`${route}/`));

  return (
    <div className={showNavAndFooter ? 'storefront-shell' : undefined}>
      {showNavAndFooter && <Navbar />}
      {children}
      {showNavAndFooter && <Footer />}
      {showNavAndFooter && browseRoute && <CompareTray />}
    </div>
  );
}
