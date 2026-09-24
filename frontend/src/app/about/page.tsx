import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { publicCatalog } from '@/lib/publicCatalog';
import type { Category, Product } from '@/types';

export const metadata = {
  title: 'Get to know NexMart',
  description: 'How NexMart keeps discovery, pricing, and after-checkout support in one clear journey.',
};

async function AboutStats() {
  const [categories, products] = await Promise.all([
    publicCatalog<Category[]>('/categories'),
    publicCatalog<Product[]>('/products?inStock=true&limit=1'),
  ]);
  const departments = categories?.data?.length;
  const inStock = products?.meta?.total;
  if (departments === undefined && inStock === undefined) return null;
  return (
    <dl className="about-stats" aria-label="Catalog snapshot">
      {departments !== undefined && (
        <div>
          <dt>Departments</dt>
          <dd>{departments}</dd>
        </div>
      )}
      {inStock !== undefined && (
        <div>
          <dt>Products in stock</dt>
          <dd>{inStock}</dd>
        </div>
      )}
      <div>
        <dt>Tax display</dt>
        <dd>GST included</dd>
      </div>
    </dl>
  );
}

const journey = [
  {
    image: '/images/collections/mobiles.webp',
    alt: 'A hand holding a mobile phone showing product choices',
    number: '01',
    title: 'Follow your curiosity.',
    copy: 'Start with a department, search by a product detail, or refine the collection by brand, price, and availability.',
  },
  {
    image: '/images/collections/audio.webp',
    alt: 'Headphones resting on a table in warm light',
    number: '02',
    title: 'Look a little closer.',
    copy: 'Explore imagery, compare options and specifications, and see the selected price before adding anything to your cart.',
  },
  {
    image: '/images/collections/living-room.webp',
    alt: 'A sunlit living room with a sofa and leafy plants',
    number: '03',
    title: 'Keep it in view.',
    copy: 'Review the total before ordering. Your account keeps saved products, addresses, payment status, and delivery updates together.',
  },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="store-page">
      <div className="page-container">
        <header className="about-hero">
          <div>
            <p className="eyebrow">Get to know NexMart</p>
            <h1>
              More clarity.
              <br />
              Better everyday choices.
            </h1>
            <p className="about-lede">
              NexMart brings product discovery, useful details, and your shopping journey
              together. Our aim is to make the next choice a little easier to understand.
            </p>
            <div className="about-cta">
              <Link href="/categories" className="btn-primary">
                Find your direction <ArrowUpRight size={17} aria-hidden />
              </Link>
              <Link href="/products?inStock=true" className="text-link">
                Available to buy <ArrowUpRight size={15} aria-hidden />
              </Link>
            </div>
            <AboutStats />
          </div>
          <div className="about-hero-photo">
            <Image
              src="/images/collections/workspace.webp"
              alt="A considered workspace with everyday essentials in warm daylight"
              fill
              priority
              sizes="(max-width: 767px) 100vw, 480px"
              className="object-cover"
            />
            <span className="about-caption">Considered essentials, clearly presented</span>
          </div>
        </header>
        <section className="about-journey" aria-label="The shopping experience">
          {journey.map(({ image, alt, number, title, copy }) => (
            <article key={number} className="about-card">
              <div className="about-card-photo">
                <Image src={image} alt={alt} fill sizes="(max-width: 767px) 100vw, 380px" className="object-cover" />
              </div>
              <div className="about-card-copy">
                <span className="font-mono text-xs text-muted" aria-hidden>
                  {number} /
                </span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="about-distinction">
          <div>
            <p className="eyebrow">A catalog taking shape</p>
            <h2 className="section-heading">
              A clear distinction
              <br />
              between inspiration and inventory.
            </h2>
          </div>
          <div>
            <p>
              Editorial photography sets the scene; catalog data carries the facts. Samples use
              illustrative prices, carry no invented reviews, and cannot be purchased. Actual
              stock is distinguished with the availability filter.
            </p>
            <p>
              Business contacts and commercial policies are still awaiting operator
              confirmation. The policy pages make that publication status visible, so you
              don’t have to guess.
            </p>
            <div className="about-links">
              <Link href="/products?inStock=true" className="text-link">
                Available to buy <ArrowUpRight size={15} aria-hidden />
              </Link>
              <Link href="/contact" className="text-link">
                Business information <ArrowUpRight size={15} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
        <section className="about-cta-band">
          <div>
            <h2 className="section-heading">Your next find starts here.</h2>
            <p>Explore the everyday edit, or head straight for what you need.</p>
          </div>
          <Link href="/products" className="btn-primary">
            Explore the collection <ArrowRight size={17} aria-hidden />
          </Link>
        </section>
      </div>
    </main>
  );
}
