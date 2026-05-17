/**
 * /login — generic login entry-point.
 * The middleware intercepts this before rendering and redirects:
 *   - Authenticated admin   → /admin
 *   - Authenticated agent   → /delivery/dashboard
 *   - Authenticated customer → /  (storefront)
 *   - Unauthenticated       → /customer/login
 *
 * This page only renders if middleware is somehow bypassed (e.g. direct
 * fetch, crawler), in which case we redirect server-side to /customer/login.
 */
import { redirect } from 'next/navigation';

export const metadata = { title: 'Login | NexMart' };

export default function LoginRootPage() {
  redirect('/customer/login');
}
