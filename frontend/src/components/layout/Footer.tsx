import Link from 'next/link';
import { ArrowUpRight, CreditCard, Search, ShoppingBag } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { policyLinks } from '@/lib/businessDetails';

const groups = {
  Discover: [{ label: 'All products', href: '/products' }, { label: 'Shop by category', href: '/categories' }, { label: 'The curated edit', href: '/products?featured=true' }, { label: 'Available to buy', href: '/products?inStock=true' }],
  'Your NexMart': [{ label: 'Orders & tracking', href: '/orders' }, { label: 'Saved products', href: '/wishlist' }, { label: 'Profile & addresses', href: '/profile' }, { label: 'Shopping help', href: '/help' }],
  'Good to know': policyLinks,
};
export function Footer() {
  return <footer className="mt-8 border-t border-[var(--border)] bg-white">
    <div className="page-container grid gap-7 border-b border-[var(--border)] py-7 md:grid-cols-3">{[{ Icon: Search, title: 'A clearer choice', copy: 'Useful specifications, options, and side-by-side comparison.' }, { Icon: CreditCard, title: 'Review before you pay', copy: 'Item prices include GST · shipping and totals shown before ordering.' }, { Icon: ShoppingBag, title: 'Keep it all together', copy: 'Saved finds, order details, and delivery updates.' }].map(({ Icon, title, copy }) => <div key={title} className="flex items-start gap-3"><Icon size={23} className="mt-1 shrink-0 text-orange-500" aria-hidden /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{copy}</p></div></div>)}</div>
    <div className="page-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-12">
      <div><Link href="/" className="inline-flex min-h-11 items-center gap-2" aria-label="NexMart home"><Logo size={30} /><span className="font-outfit text-2xl font-semibold">NexMart</span></Link><p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Good finds. Thoughtful details.<br />A little more your kind of everyday.</p><Link href="/about" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-secondary">Get to know NexMart <ArrowUpRight size={15} aria-hidden /></Link></div>
      {Object.entries(groups).map(([title, items]) => <nav key={title} aria-label={title}><h2 className="mb-3 text-sm font-semibold">{title}</h2><ul>{items.map(item => <li key={item.href}><Link href={item.href} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-[var(--text-primary)]">{item.label}</Link></li>)}</ul></nav>)}
    </div>
    <div className="border-t border-[var(--border)]"><div className="page-container flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted"><p>© {new Date().getFullYear()} NexMart</p><p>INR · Prices include GST · Online payments via Razorpay · COD where available</p></div></div>
  </footer>;
}
