import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, ClipboardCheck, CreditCard, PackageCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

export const metadata: Metadata = { title: 'About NexMart' };

export default function AboutPage() {
  return <main id="main-content" className="store-page"><div className="page-container">
    <div className="max-w-3xl"><PageHeader eyebrow="About NexMart" title="Shopping with a clearer picture." description="NexMart is an online store for discovering products, comparing their details, and keeping your purchases in one place." />
      <p className="text-secondary">Our aim is simple: help you make an informed choice. Product details, available options, stock, and prices belong close to the decision to buy. Your order should remain easy to follow after checkout.</p>
    </div>
    <section className="mt-10 grid gap-6 border-y border-white/10 py-8 md:grid-cols-3" aria-label="How the store works">
      {[{ Icon: ClipboardCheck, title: 'Know what you are choosing', copy: 'Compare product specifications and available options. Reviews marked as verified purchases are linked to a completed purchase.' }, { Icon: CreditCard, title: 'Review before you pay', copy: 'Checkout shows your delivery address, items, shipping, tax, and total. Choose online payment through Razorpay or cash on delivery.' }, { Icon: PackageCheck, title: 'Keep the order in view', copy: 'Your account brings together order history, payment status, delivery progress, and available invoices.' }].map(({ Icon, title, copy }) => <div key={title}><Icon size={25} className="mb-4 text-violet-200" aria-hidden /><h2 className="text-xl">{title}</h2><p className="mt-3 text-sm leading-relaxed text-secondary">{copy}</p></div>)}
    </section>
    <section className="mt-10 max-w-2xl"><h2 className="section-heading">Make your next choice.</h2><p className="mt-3 text-secondary">Start with a category, search for a product, or revisit something you have saved.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/products" className="btn-primary">Browse products <ArrowRight size={17} aria-hidden /></Link><Link href="/help" className="btn-secondary">Shopping help</Link></div></section>
  </div></main>;
}
