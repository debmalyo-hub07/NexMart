'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Shield, Truck, Star } from 'lucide-react';
import { GlowOrb } from '@/components/common/GlowOrb';
import { Counter } from '@/components/common/Counter';
import { ProductCard } from '@/components/product/ProductCard';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ProductCardSkeleton } from '@/components/common/SkeletonLoader';
// Direct import — page.tsx is 'use client', so Three.js is safe to bundle here.
// Avoids the lazy-chunk download delay caused by dynamic({ ssr: false }).
import { HeroBackground } from '@/components/common/HeroBackground';

const categories = [
  { name: 'Electronics', slug: 'electronics', emoji: '💻', color: 'from-violet-600/20 to-violet-900/20' },
  { name: 'Fashion', slug: 'fashion', emoji: '👗', color: 'from-pink-600/20 to-pink-900/20' },
  { name: 'Home & Living', slug: 'home-living', emoji: '🏠', color: 'from-amber-600/20 to-amber-900/20' },
  { name: 'Books', slug: 'books', emoji: '📚', color: 'from-acid-400/20 to-acid-600/20' },
  { name: 'Sports', slug: 'sports', emoji: '⚽', color: 'from-blue-600/20 to-blue-900/20' },
  { name: 'Beauty', slug: 'beauty', emoji: '✨', color: 'from-rose-600/20 to-rose-900/20' },
];

const stats = [
  { label: 'Products Listed', value: 250000, suffix: '+' },
  { label: 'Happy Customers', value: 500000, suffix: '+' },
  { label: 'Cities Delivered', value: 500, suffix: '+' },
  { label: 'Seller Partners', value: 10000, suffix: '+' },
];

const testimonials = [
  { name: 'Priya S.', city: 'Mumbai', rating: 5, text: 'Amazing! Got my order in 2 days. Quality exceeded expectations.' },
  { name: 'Rahul M.', city: 'Delhi', rating: 5, text: 'Best prices online. Customer support was incredibly responsive.' },
  { name: 'Ananya P.', city: 'Bengaluru', rating: 5, text: 'The website feels so premium. Love the dark design!' },
];

export default function HomePage() {
  const textRef = useRef<HTMLHeadingElement>(null);

  const { data: featuredData, isLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => api.get('/products?featured=true&limit=8').then((r) => r.data),
  });

  const products = featuredData?.data || [];

  useEffect(() => {
    if (!textRef.current) return;

    // Dynamically import ScrollTrigger to keep SSR safe
    import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      gsap.registerPlugin(ScrollTrigger);

      const chars = textRef.current?.querySelectorAll('.char');
      if (chars?.length) {
        gsap.fromTo(chars,
          { opacity: 0, y: 60 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.03, ease: 'power4.out', delay: 0.2 }
        );
      }

      // ScrollTrigger setups for sections
      const sections = document.querySelectorAll('.gsap-section');
      sections.forEach((section) => {
        gsap.fromTo(section,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
            },
          }
        );
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-[72px] overflow-hidden">
        <HeroBackground />
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
              <Link href="/products" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold text-base px-8 py-4 rounded-full flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(167,139,250,0.4)] group">
                Explore Products <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/#categories" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-base px-8 py-4 rounded-full transition-all hover:border-white/20">
                View Categories
              </Link>
            </motion.div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="flex items-center justify-center gap-10 sm:gap-24 mt-16 mb-8 w-full border-t border-white/5 pt-10">
            <div className="text-center">
              <p className="text-4xl font-bold text-white mb-1">10K+</p>
              <p className="text-sm text-white/50">Products</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-white mb-1">50K+</p>
              <p className="text-sm text-white/50">Happy Customers</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-white mb-1">4.8</p>
              <p className="text-sm text-white/50">Avg. Rating</p>
            </div>
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
            {categories.map(({ name, slug, emoji, color }, i) => (
              <motion.div key={slug} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Link href={`/categories/${slug}`} className={`block glass rounded-2xl p-5 text-center hover:scale-105 transition-all duration-300 bg-gradient-to-b ${color} border border-white/5 hover:border-white/15 group`}>
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
              transition={{ duration: 0.7, ease: 'easeOut' }}
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
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 px-6 py-3 rounded-full transition-all group"
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
                  transition={{ duration: 0.55, ease: 'easeOut', delay }}
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

      {/* Testimonials */}
      <section className="section bg-space-800/30 gsap-section">
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="font-syne text-3xl md:text-4xl font-bold text-white mb-4">What Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, city, rating, text }, i) => (
              <motion.div key={name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="card">
                <div className="flex mb-3">
                  {Array(rating).fill(0).map((_, j) => <Star key={j} size={14} className="fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-300">{name[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-xs text-white/40">{city}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>    </div>
  );
}
