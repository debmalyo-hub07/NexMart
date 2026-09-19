import Link from 'next/link';
import { businessDetails } from '@/lib/businessDetails';

export function ShoppingPolicyLinks() {
  return <div className="border-t border-white/15 pt-3 text-xs leading-relaxed text-muted"><p>Before you order, review our <Link href="/terms" className="underline underline-offset-4">terms</Link>, <Link href="/shipping" className="underline underline-offset-4">delivery information</Link>, and <Link href="/returns" className="underline underline-offset-4">returns & cancellation policy</Link>.</p>{!businessDetails.policiesApproved && <p className="mt-2 text-amber-200">Policy drafts: business contacts and commercial terms still need confirmation. <Link href="/contact" className="underline underline-offset-4">View status</Link>.</p>}</div>;
}
