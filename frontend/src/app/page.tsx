'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GlowOrb } from '@/components/common/GlowOrb';
import { ProductCard } from '@/components/product/ProductCard';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const HeroBackground = dynamic(
  () => import('@/components/common/HeroBackground').then((mod) => mod.HeroBackground),
  { ssr: false }
);

interface CategoryTile {
  name: string;
  slug: string;
  parent?: { _id: string } | string | null;
  icon?: string;
  displayOrder: number;
}

export default function HomePage() {
  const textRef = useRef<HTMLHeadingElement>(null);

  const { data: featuredData, isLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => api.get('/products?featured=true&limit=8').then((r) => r.data),
  });

  const products = featuredData?.data || [];

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['homepage', 'categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const categories = ((categoriesData?.data || []) as CategoryTile[])
    .filter((c) => !c.parent)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 8)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      emoji: c.icon || '🛍️',
      color: 'from-violet-600/20 to-violet-900/20',
    }));

  useEffect(() => {
    let ctx: gsap.Context;

    import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const chars = textRef?.current?.querySelectorAll('.char');
        if (chars?.length) {
          gsap.fromTo(chars,
            { opacity: 0, y: 60 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.03, ease: 'power4.out', delay: 0.2 }
          );
        }

        const sections = document.querySelectorAll('.gsap-section');
        sections.forEach((section) => {
          gsap.fromTo(section,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: section,
                start: 'top 85%',
              },
            }
          );
        });

        // Trigger ScrollTrigger refresh
        ScrollTrigger.refresh();
      });
    });

    return () => {
      if (ctx) ctx.revert();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-[72px] overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0 bg-[#0a0a0f]" />}>
          <HeroBackground />
        </Suspense>
        <GlowOrb color="violet" size="xl" className="-top-32 -left-32 opacity-30" />
        <GlowOrb color="acid" size="lg" className="top-1/2 -right-48 opacity-20" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="page-container relative z-10 py-12 flex flex-col justify-center items-center min-h-[calc(100vh-72px)]">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-4xl mx-auto mt-4">
            <h1 ref={textRef} className="font-syne text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-[1.1]">
              Shop Smarter, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">Live</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">Better</span>
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="text-base md:text-lg text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              Discover a world of premium products curated for the modern lifestyle. From cutting-edge electronics to timeless fashion — experience shopping reimagined.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/products" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold text-base px-8 py-4 rounded-full flex items-center gap-2 transition-shadow hover:shadow-[0_0_20px_rgba(167,139,250,0.4)] group">
                Explore Products <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/#categories" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-base px-8 py-4 rounded-full transition-colors hover:border-white/20">
                View Categories
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>



      {/* Categories */}
      <section id="categories" className="section gsap-section">
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="font-syne text-3xl md:text-4xl font-bold text-white mb-4">Shop by Category</h2>
            <p className="text-white/50">Explore our wide range of product categories</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoriesLoading || categories.length === 0
              ? Array(6).fill(0).map((_, i) => (
                  <div key={i} className="glass rounded-2xl p-5 text-center bg-gradient-to-b from-violet-600/20 to-violet-900/20 border border-white/5">
                    <span className="block mb-3 mx-auto h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                    <p className="font-syne font-semibold text-white text-sm">
                      <span className="block h-4 w-20 mx-auto rounded bg-white/10 animate-pulse" />
                    </p>
                  </div>
                ))
              : categories.map(({ name, slug, emoji, color }, i) => (
                  <motion.div key={slug} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                    <Link href={`/categories/${slug}`} className={`block glass rounded-2xl p-5 text-center hover:scale-105 transition-[transform,border-color] duration-300 bg-gradient-to-b ${color} border border-white/5 hover:border-white/15 group`}>
                      <span className="text-5xl block mb-3 group-hover:scale-110 transition-transform duration-300">{emoji}</span>
                      <p className="font-syne font-semibold text-white text-sm">{name}</p>
                    </Link>
                  </motion.div>
                ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="section bg-space-800/30 gsap-section">
        <div className="page-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-syne text-3xl md:text-4xl font-bold text-white mb-2">Trending Now</h2>
              <p className="text-white/50">The most popular products this week</p>
            </div>
            <Link href="/products?featured=true" className="btn-secondary text-sm hidden md:flex items-center gap-2">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {isLoading
              ? Array(8).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((p: Parameters<typeof ProductCard>[0]['product']) => <ProductCard key={p._id} product={p} />)
            }
          </div>
        </div>
      </section>

      {/* Brand Story — Animated Timeline */}
      <section className="section gsap-section overflow-hidden">
        <div className="page-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left — Story copy */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:sticky lg:top-28"
            >
              <span className="inline-block text-[10px] font-semibold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6">
                Our Story
              </span>
              <h2 className="font-syne text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-6">
                Crafting the future{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                  of online shopping
                </span>
              </h2>
              <p className="text-white/55 text-base leading-relaxed mb-8 max-w-md">
                What started as a small team of three passionate individuals in a garage has grown into one of India's most trusted e-commerce platforms. We believe shopping should be delightful, not stressful. Every pixel, every interaction, every delivery — crafted with care.
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 px-6 py-3 rounded-full transition-colors group"
              >
                Read Full Story
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* Right — Vertical timeline */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/60 via-fuchsia-500/40 to-transparent origin-top"
              />

              {[
                {
                  year: '2019',
                  icon: '🚀',
                  title: 'Founded',
                  desc: 'NexMart was born from a simple idea — make quality shopping accessible to everyone, everywhere.',
                  delay: 0.1,
                },
                {
                  year: '2020',
                  icon: '📦',
                  title: '10K+ Products',
                  desc: 'Expanded our catalog to over 10,000 products across 20+ categories, partnering with trusted brands worldwide.',
                  delay: 0.25,
                },
                {
                  year: '2022',
                  icon: '🛡️',
                  title: '50K+ Customers',
                  desc: 'Crossed 50,000 happy customers with a 4.8★ satisfaction rating and 98% on-time delivery rate.',
                  delay: 0.4,
                },
                {
                  year: '2024',
                  icon: '🚚',
                  title: 'Pan-India Delivery',
                  desc: 'Now delivering to every pin code in India with same-day delivery in 12 major cities.',
                  delay: 0.55,
                },
              ].map(({ year, icon, title, desc, delay }) => (
                <motion.div
                  key={year}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay }}
                  className="relative mb-10 last:mb-0"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-8 top-0 w-[30px] h-[30px] rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                    <span className="text-[13px]">{icon}</span>
                  </div>

                  <div className="glass rounded-2xl p-5 border border-white/5 hover:border-violet-500/20 transition-colors ml-2">
                    <span className="text-[11px] font-bold tracking-widest text-violet-400/70 mb-1 block">{year}</span>
                    <h3 className="font-syne font-bold text-white text-lg mb-2">{title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
