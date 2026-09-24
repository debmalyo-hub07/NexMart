import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, ArrowUpRight, CreditCard, GitCompareArrows, PackageCheck, ReceiptText } from 'lucide-react';
import { HomeCategories, HomeEditorial, HomeMoreProducts } from '@/components/home/HomeCatalog';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { Reveal } from '@/components/common/Reveal';
import { Skeleton } from '@/components/common/SkeletonLoader';
import { publicCatalog } from '@/lib/publicCatalog';
import type { Category, Product } from '@/types';

async function Categories() {
  const categories = await publicCatalog<Category[]>('/categories');
  return <HomeCategories categories={categories?.data} />;
}
async function Collections() {
  const [products, arrivals] = await Promise.all([publicCatalog<Product[]>('/products?featured=true&limit=8'), publicCatalog<Product[]>('/products?limit=12')]);
  return <HomeMoreProducts products={products?.data} arrivals={arrivals} />;
}

export default function HomePage() {
  return <main id="main-content" className="pt-[var(--navbar-height)]">
    <Suspense fallback={<div className="page-container py-5"><Skeleton className="h-28 rounded-xl" /></div>}><Categories /></Suspense>
    <section className="page-container" aria-label="Discover your everyday">
      <div className="campaign-grid">
        <article className="campaign campaign-home">
          <Image src="/images/collections/living-room.webp" alt="A sunlit living room with natural textures, a sofa, and leafy plants" fill priority sizes="(max-width: 767px) 100vw, (max-width: 1023px) 65vw, 950px" className="campaign-photo object-cover" />
          <div className="campaign-shade" />
          <div className="campaign-copy">
            <span className="campaign-kicker">THE EVERYDAY EDIT</span>
            <h1>Little upgrades.<br />Big <em>everyday</em><br />energy.</h1>
            <p>Make room for the things you love.<br />Discover thoughtful finds for every part of your day.</p>
            <Link href="/categories/home" className="campaign-button">Explore home & living <ArrowRight size={18} aria-hidden /></Link>
            <Link href="/products" className="campaign-all">Or, explore everything <ArrowUpRight size={15} aria-hidden /></Link>
          </div>
          <span className="campaign-caption">A fresh perspective on home</span>
        </article>
        <div className="campaign-side">
          <Link href="/categories/electronics" className="campaign campaign-tech group">
            <Image src="/images/collections/audio.webp" alt="" fill sizes="(max-width: 767px) 46vw, 380px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="campaign-side-shade" />
            <div className="campaign-side-copy"><span className="campaign-kicker">IN YOUR ELEMENT</span><h2>Better sound.<br />Better days.</h2><span className="campaign-link">Explore tech <ArrowUpRight size={17} aria-hidden /></span></div>
          </Link>
          <Link href="/products?maxPrice=1999" className="campaign campaign-budget group">
            <span className="campaign-kicker">SMALL FINDS. BIG POSSIBILITIES.</span>
            <h2>A little budget.<br />A lot to love.</h2>
            <p>Discover finds under <strong>₹1,999</strong></p>
            <span className="campaign-link">Find your next favourite <ArrowUpRight size={17} aria-hidden /></span>
            <span className="budget-orbit" aria-hidden>₹</span>
          </Link>
        </div>
      </div>
      <div className="shopping-benefits">
        {[{ Icon: ReceiptText, title: 'Clear prices', copy: 'Applicable taxes included. Delivery shown in your cart.', href: '/shipping' }, { Icon: GitCompareArrows, title: 'A choice that fits', copy: 'Compare products, options, and sellers.', href: '/products' }, { Icon: PackageCheck, title: 'Your order, in view', copy: 'Track progress and get order-linked help.', href: '/orders' }, { Icon: CreditCard, title: 'Pay with confidence', copy: 'Online payments handled by Razorpay.', href: '/help' }].map(({ Icon, title, copy, href }) => <Link key={title} href={href}><span className="benefit-mark"><Icon size={22} strokeWidth={1.6} aria-hidden /></span><span><strong>{title}</strong><small>{copy}</small></span></Link>)}
      </div>
    </section>
    <Suspense fallback={<div className="page-container section"><Skeleton className="h-96" /></div>}><Collections /></Suspense>
    <section className="page-container section pt-0" aria-labelledby="home-planner">
      <Reveal>
      <div className="planner-banner">
        <div><p className="eyebrow">A LITTLE MORE THOUGHT. A LITTLE LESS GUESSWORK.</p><h2 id="home-planner">One budget.<br />The whole picture.</h2><p>Put together your next setup, room refresh, or everyday essentials. See how everything adds up, including delivery.</p><Link href="/planner" className="btn-primary">Build your shopping plan <ArrowRight size={17} aria-hidden /></Link></div>
        <div className="planner-banner-photo"><Image src="/images/collections/workspace.webp" alt="A bright workspace with desks and plants" fill sizes="(max-width: 767px) 100vw, 620px" className="object-cover" /><span className="planner-caption">Your ideas. Your budget. Your plan.</span></div>
      </div>
      </Reveal>
    </section>
    <Reveal><HomeEditorial /></Reveal>
    <RecentlyViewed />
    <section className="page-container section" aria-labelledby="seller-invitation"><Reveal><div className="seller-invitation"><div><p className="eyebrow">FOR THE MAKERS. THE CURATORS. THE GO-GETTERS.</p><h2 id="seller-invitation">Your next chapter starts with a storefront.</h2><p>Bring your products to NexMart. Manage your listings, inventory, orders, and finances in one seller workspace.</p></div><Link href="/seller/register" className="btn-secondary">Start selling <ArrowUpRight size={18} aria-hidden /></Link></div></Reveal></section>
  </main>;
}
