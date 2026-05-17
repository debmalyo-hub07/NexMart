'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define paths where Navbar and Footer should NOT appear
  const isAuth = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/verify-otp');
  const isAdmin = pathname?.startsWith('/admin');
  const isDelivery = pathname?.startsWith('/delivery');
  
  const showNavAndFooter = !isAuth && !isAdmin && !isDelivery;

  return (
    <>
      {showNavAndFooter && <Navbar />}
      {children}
      {showNavAndFooter && <Footer />}
    </>
  );
}
