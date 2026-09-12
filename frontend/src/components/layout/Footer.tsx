import Link from 'next/link';
import { Logo } from '@/components/common/Logo';

const links = {
  Shop: [{ label: 'All products', href: '/products' }, { label: 'Categories', href: '/categories' }, { label: 'Search the catalog', href: '/search' }],
  'Your account': [{ label: 'Orders & tracking', href: '/orders' }, { label: 'Saved products', href: '/wishlist' }, { label: 'Profile & addresses', href: '/profile' }],
  NexMart: [{ label: 'About the store', href: '/about' }, { label: 'Shopping help', href: '/help' }],
};

export function Footer() {
  return <footer className="border-t border-white/10 bg-space-800">
    <div className="page-container grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:py-10">
      <div><Link href="/" className="inline-flex min-h-11 items-center gap-2" aria-label="NexMart home"><Logo size={28} /><span className="font-outfit text-xl font-semibold">NexMart</span></Link><p className="mt-2 max-w-xs text-sm text-muted">Discover, compare, and keep track of what comes next.</p></div>
      {Object.entries(links).map(([title, items]) => <nav key={title} aria-label={title}><h2 className="mb-2 text-sm font-semibold">{title}</h2><ul>{items.map(item => <li key={item.href}><Link href={item.href} className="inline-flex min-h-11 items-center text-sm text-secondary hover:text-white">{item.label}</Link></li>)}</ul></nav>)}
    </div>
    <div className="border-t border-white/10"><div className="page-container flex flex-wrap justify-between gap-3 py-5 text-xs text-muted"><p>NexMart</p><p>Online payments via Razorpay · Cash on delivery</p></div></div>
  </footer>;
}
