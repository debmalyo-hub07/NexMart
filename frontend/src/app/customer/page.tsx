/**
 * /customer — root redirect page.
 * The middleware will intercept this and redirect:
 *   - Authenticated customers  → /  (storefront)
 *   - Unauthenticated visitors → /customer/login
 * This page is only rendered as a brief pass-through; a tiny redirect
 * component is supplied for robustness in case middleware is bypassed.
 */
import { redirect } from 'next/navigation';

export const metadata = { title: 'Customer | NexMart' };

export default function CustomerRootPage() {
  // Server-side fallback: just send to storefront root.
  // Middleware handles the auth-aware redirect before this runs.
  redirect('/');
}
