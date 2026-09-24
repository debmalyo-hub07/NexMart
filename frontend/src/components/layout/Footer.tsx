import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { policyLinks } from '@/lib/businessDetails';

const groups = {
  'Find your everyday': [{ label: 'Explore all products', href: '/products' }, { label: 'Shop by department', href: '/categories' }, { label: 'Shop by budget', href: '/budget' }, { label: 'Build a shopping plan', href: '/planner' }],
  'Make yourself at home': [{ label: 'Your orders & tracking', href: '/orders' }, { label: 'Your wishlist', href: '/wishlist' }, { label: 'Account & addresses', href: '/profile' }, { label: 'Help & support', href: '/help' }, { label: 'Sell on NexMart', href: '/seller/register' }],
  'The useful details': policyLinks,
};
export function Footer() {
  return <footer className="market-footer mt-8">
    <div className="page-container grid gap-9 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.1fr_1fr]">
      <div><Link href="/" className="brand-wordmark" aria-label="NexMart home"><Logo size={36} />NexMart<small>.</small></Link><p className="mt-5 max-w-xs text-sm leading-relaxed">Good finds for a life that’s yours.<br />A little more thoughtful. A little more everyday.</p><Link href="/about" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm">Get to know us <ArrowUpRight size={15} aria-hidden /></Link><div className="mt-5 flex flex-wrap gap-2" aria-label="Payment methods"><span className="payment-wordmark">UPI</span><span className="payment-wordmark">CARDS</span><span className="payment-wordmark">NETBANKING</span><span className="payment-wordmark">COD</span></div><p className="mt-3 text-xs">Online payments via Razorpay.</p></div>
      {Object.entries(groups).map(([title, items]) => <nav key={title} aria-label={title}><h2 className="mb-3 font-semibold">{title}</h2><ul>{items.map(item => <li key={item.href}><Link href={item.href} className="inline-flex min-h-11 items-center text-xs">{item.label}</Link></li>)}</ul></nav>)}
    </div>
    <div className="footer-rule border-t"><div className="page-container flex flex-wrap items-center justify-between gap-3 py-5 text-xs"><p>© {new Date().getFullYear()} NexMart. Made for your everyday.</p><p>India · INR ₹ · Applicable taxes included</p></div></div>
  </footer>;
}
