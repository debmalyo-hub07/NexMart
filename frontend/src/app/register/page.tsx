/**
 * /register — generic register entry-point.
 * The middleware intercepts this before rendering and redirects:
 *   - Authenticated admin    → /admin
 *   - Authenticated agent    → /delivery/dashboard
 *   - Authenticated customer → /  (storefront)
 *   - Unauthenticated        → /customer/register
 *
 * This page only renders if middleware is somehow bypassed, in which
 * case we redirect server-side to /customer/register.
 */
import { redirect } from 'next/navigation';

export const metadata = { title: 'Register | NexMart' };

export default function RegisterRootPage() {
  redirect('/customer/register');
}
