import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, ArrowUpRight, CreditCard, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { HomeCategories, HomeDiscovery, HomeEditorial, HomeMoreProducts, HomeSpotlight } from '@/components/home/HomeCatalog';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { Skeleton } from '@/components/common/SkeletonLoader';
import { publicCatalog } from '@/lib/publicCatalog';
import type { Category, Product } from '@/types';

async function Spotlight() {
  const products = await publicCatalog<Product[]>('/products?featured=true&limit=8');
  return <HomeSpotlight products={products?.data} />;
}
async function Categories() {
  const categories = await publicCatalog<Category[]>('/categories');
  return <HomeCategories categories={categories?.data} />;
}
async function Collections() {
  const [products, arrivals] = await Promise.all([publicCatalog<Product[]>('/products?featured=true&limit=8'), publicCatalog<Product[]>('/products?limit=12')]);
  return <HomeMoreProducts products={products?.data} arrivals={arrivals} />;
}
async function Editorial() {
  const categories = await publicCatalog<Category[]>('/categories');
  return <HomeEditorial categories={categories?.data} />;
}

export default function HomePage() {
  return <main id="main-content" className="pt-[var(--navbar-height)]">
    <section className="page-container pt-5 sm:pt-7">
      <div className="home-hero grid items-center gap-6 p-5 sm:p-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:p-9">
        <div className="relative py-5 lg:py-8">
          <p className="eyebrow mb-5 text-orange-600">A fresh perspective on everyday shopping</p>
          <h1 className="max-w-xl text-[clamp(2.8rem,5.2vw,4.75rem)] font-medium leading-[1.04] tracking-[-0.045em]">Good finds.<br />For your kind<br />of <span className="text-[#123E75]">everyday.</span></h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-secondary sm:text-base">From a smarter setup to a softer corner at home. Explore the details, compare your favourites, and find what feels right.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/products" className="btn-primary px-6">Discover the collection <ArrowRight size={17} aria-hidden /></Link><Link href="/categories" className="btn-secondary">Find your category <ArrowUpRight size={17} aria-hidden /></Link></div>
          <HomeDiscovery />
        </div>
        <div className="relative min-w-0"><Suspense fallback={<Skeleton className="h-[500px] rounded-2xl" />}><Spotlight /></Suspense></div>
      </div>
    </section>
    <div className="page-container"><div className="grid gap-4 border-b border-[var(--border)] py-6 sm:grid-cols-2 lg:grid-cols-4">
      {[{ Icon: Truck, title: 'Free delivery over ₹999', copy: '₹49 flat below that. Every price includes GST.' }, { Icon: RotateCcw, title: '7-day easy returns', copy: 'Not right? Start a return from your orders page.' }, { Icon: CreditCard, title: 'Pay your way', copy: 'UPI, cards, netbanking — or cash on delivery where available.' }, { Icon: ShieldCheck, title: 'Secure checkout', copy: 'Payments by Razorpay. Card details never touch our servers.' }].map(({ Icon, title, copy }) => <div key={title} className="flex items-center gap-3"><Icon size={22} strokeWidth={1.5} className="shrink-0 text-orange-500" aria-hidden /><div><h2 className="text-sm">{title}</h2><p className="mt-1 text-xs text-muted">{copy}</p></div></div>)}
    </div></div>
    <section className="page-container flex flex-wrap items-center gap-3 pt-6" aria-labelledby="shop-by-budget">
      <h2 id="shop-by-budget" className="mr-1 text-sm font-semibold">Shop by budget</h2>
      {[['Under ₹999', 999], ['Under ₹1,999', 1999], ['Under ₹4,999', 4999], ['Under ₹9,999', 9999]].map(([label, max]) => <Link key={max} href={`/products?maxPrice=${max}`} className="rounded-full border border-[var(--border-control)] bg-white px-4 py-2 text-xs font-medium text-secondary transition-colors hover:border-orange-500 hover:text-orange-600">{label}</Link>)}
      <Link href="/budget?maxPrice=1999" className="text-xs font-medium text-orange-600">Plan a budget ↗</Link>
      <Link href="/products?sort=price" className="text-xs font-medium text-orange-600">Lowest price first ↗</Link>
    </section>
    <Suspense fallback={<div className="page-container py-12"><Skeleton className="h-48" /></div>}><Categories /></Suspense>
    <Suspense fallback={<div className="page-container py-12"><Skeleton className="h-96" /></div>}><Collections /></Suspense>
    <RecentlyViewed />
    <Suspense fallback={<div className="page-container py-8"><Skeleton className="h-64" /></div>}><Editorial /></Suspense>
    <section className="page-container pb-12 sm:pb-16"><div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-9"><div><p className="eyebrow mb-2">A little clarity goes a long way</p><h2 className="text-2xl sm:text-3xl">Good shopping starts with good information.</h2><p className="mt-3 max-w-xl text-sm text-muted">Understand your total, your payment options, and what happens after you order.</p></div><Link href="/help" className="btn-secondary">Your shopping guide <ArrowUpRight size={17} aria-hidden /></Link></div></section>
  </main>;
}
