/**
 * /delivery — root redirect page.
 * The middleware will intercept this and redirect:
 *   - Authenticated agents  → /delivery/dashboard
 *   - Unauthenticated users → /delivery/login
 * This page is only rendered as a brief pass-through.
 */
import { redirect } from 'next/navigation';

export const metadata = { title: 'Delivery | NexMart' };

export default function DeliveryRootPage() {
  // Server-side fallback: send to dashboard.
  // Middleware handles auth-aware redirect before this runs.
  redirect('/delivery/dashboard');
}
