import Link from 'next/link';
import { CreditCard, MapPin, PackageCheck } from 'lucide-react';
import { HomeDiscovery, HomeMoreProducts, HomeSpotlight } from '@/components/home/HomeCatalog';
import { serverApiFetch } from '@/lib/serverApi';
import { type ApiResponse, type Category, type Product } from '@/types';

async function publicCatalog<T>(path: string): Promise<T | undefined> {
  try {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const response = await serverApiFetch(`${url}${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const payload: ApiResponse<T> = await response.json();
    return payload.data;
  } catch { return undefined; }
}

export default async function HomePage() {
  const [products, categories] = await Promise.all([publicCatalog<Product[]>('/products?featured=true&limit=8'), publicCatalog<Category[]>('/categories')]);
  return <main id="main-content" className="pt-[var(--navbar-height)]">
    <section className="relative border-b border-white/10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(124,58,237,0.13),transparent_65%)]" />
      <div className="page-container relative grid items-center gap-7 py-7 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)] lg:gap-16 lg:py-12">
        <div className="min-w-0">
          <p className="eyebrow mb-3 text-violet-200">NexMart · Online store</p>
          <h1 className="max-w-xl text-[clamp(2.25rem,5.3vw,4.5rem)] leading-[1.04] tracking-[-0.04em]">Your next find.<br /><span className="text-violet-200">A clearer choice.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-secondary sm:text-base">Explore products, compare the details, and follow your order from checkout to delivery.</p>
          <HomeDiscovery categories={categories} />
        </div>
        <div className="min-w-0"><HomeSpotlight products={products} /></div>
      </div>
    </section>
    <HomeMoreProducts products={products} />
    <section className="page-container py-8 sm:py-10" aria-label="Shopping at NexMart">
      <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
        {[{ Icon: CreditCard, title: 'Choose how to pay', text: 'Online payment through Razorpay or cash on delivery at checkout.' }, { Icon: MapPin, title: 'Keep delivery details together', text: 'Save addresses to your account and review them before you order.' }, { Icon: PackageCheck, title: 'Follow every order', text: 'Payment and delivery updates are available in your order details.' }].map(({ Icon, title, text }) => <div key={title} className="flex items-start gap-3"><Icon size={21} className="mt-1 shrink-0 text-violet-200" aria-hidden /><div><h2 className="text-base">{title}</h2><p className="mt-1 text-sm text-muted">{text}</p></div></div>)}
      </div>
      <Link href="/about" className="mt-6 inline-flex min-h-11 items-center text-sm text-secondary underline underline-offset-4 hover:text-white">Get to know NexMart</Link>
    </section>
  </main>;
}
