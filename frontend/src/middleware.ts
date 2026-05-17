import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = (session?.user as { role?: string })?.role;
  const isAuthenticated = !!session;
  const lastRole = req.cookies.get('last_role')?.value;

  // ── Generic /login and /register entry-points ─────────────────
  // These paths don't belong to any role — redirect everyone appropriately.
  if (pathname === '/login' || pathname === '/register') {
    if (isAuthenticated) {
      // Bounce each role back to their dedicated home
      if (role === 'admin')  return NextResponse.redirect(new URL('/admin', req.url));
      if (role === 'agent')  return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
      // Authenticated customer → storefront
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Unauthenticated → forward to the right customer form
    const dest = pathname === '/login' ? '/customer/login' : '/customer/register';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // ── Admin routes ──────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/register')) {
      if (isAuthenticated) {
        if (role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
        if (role === 'agent') return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }
    
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    if (role !== 'admin') {
      if (role === 'agent') return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // ── Delivery routes ───────────────────────────────────────────
  if (pathname.startsWith('/delivery')) {
    // Block login/register pages when already authenticated
    if (pathname.startsWith('/delivery/login') || pathname.startsWith('/delivery/register')) {
      if (isAuthenticated) {
        if (role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
        if (role === 'agent') return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }

    // Root /delivery — redirect to the right place based on auth state
    if (pathname === '/delivery') {
      if (!isAuthenticated) return NextResponse.redirect(new URL('/delivery/login', req.url));
      if (role === 'agent') return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
      if (role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
      return NextResponse.redirect(new URL('/', req.url));
    }

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/delivery/login', req.url));
    }
    if (role !== 'agent') {
      if (role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // ── Customer routes & App roots ────────────────────────────────
  // Admin and Agent should never see customer routes or root
  if (isAuthenticated && role === 'admin' && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (isAuthenticated && role === 'agent' && !pathname.startsWith('/delivery')) {
    return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
  }

  // Root /customer — act as an entry-point redirect, matching /admin and /delivery behavior
  if (pathname === '/customer') {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/customer/login', req.url));
    // Authenticated customer → go to storefront
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Protected customer paths
  const protectedPaths = ['/cart', '/checkout', '/orders', '/profile'];
  if (protectedPaths.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/customer/login?redirect=${pathname}`, req.url));
    }
  }

  // Redirect auth paths away if logged in; allow verify-otp always (needed before login)
  if (pathname.startsWith('/customer/verify-otp')) {
    return NextResponse.next(); // always allow — needed for post-registration email verification
  }

  if (pathname.startsWith('/customer/login') || pathname.startsWith('/customer/register')) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // Handle root unauthenticated persistence
  if (pathname === '/' && !isAuthenticated) {
    if (lastRole === 'admin') return NextResponse.redirect(new URL('/admin/login', req.url));
    if (lastRole === 'agent') return NextResponse.redirect(new URL('/delivery/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images|assets|api/auth).*)',
  ],
};
