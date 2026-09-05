import { GlowOrb } from '@/components/common/GlowOrb';
import { Counter } from '@/components/common/Counter';
import Image from 'next/image';
import Link from 'next/link';
import { Zap, Shield, Heart, Award } from 'lucide-react';

const VALUES = [
  { icon: Zap, title: 'Speed First', desc: 'Lightning-fast delivery to your doorstep within 24–48 hours across India.' },
  { icon: Shield, title: 'Genuine Products', desc: 'Every product is authenticated and sourced directly from brands and authorized dealers.' },
  { icon: Heart, title: 'Customer Obsessed', desc: 'Our 24/7 support team is always here. 30-day hassle-free returns, no questions asked.' },
  { icon: Award, title: 'Quality Guaranteed', desc: 'Rigorous quality checks before dispatch. We never compromise on what reaches you.' },
];

const STATS = [
  { value: 500000, label: 'Happy Customers', suffix: '+' },
  { value: 50000, label: 'Products Listed', suffix: '+' },
  { value: 200, label: 'Cities Served', suffix: '+' },
  { value: 99, label: 'Satisfaction Rate', suffix: '%' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <GlowOrb color="violet" size="xl" className="top-0 left-1/4 opacity-30" />
          <GlowOrb color="acid" size="lg" className="bottom-0 right-1/4 opacity-20" />
          <div className="page-container relative text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-violet-300 border border-violet-500/20 mb-6">
              🚀 Our Story
            </div>
            <h1 className="font-syne text-5xl md:text-6xl font-black text-white leading-tight mb-6">
              Built for the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">next generation</span>{' '}
              of shoppers
            </h1>
            <p className="text-lg text-white/50 leading-relaxed">
              NexMart was founded in 2024 with a single mission: make premium shopping accessible to every Indian household. 
              We're not just another marketplace — we're redefining what e-commerce feels like.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 border-y border-white/5 bg-space-800/30">
          <div className="page-container grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label, suffix }) => (
              <div key={label} className="text-center">
                <div className="font-syne text-4xl font-black text-acid-400">
                  <Counter end={value} suffix={suffix} duration={2} />
                </div>
                <p className="text-sm text-white/40 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="py-20">
          <div className="page-container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Our Mission</p>
              <h2 className="font-syne text-4xl font-bold text-white mb-6">
                Making quality accessible — everywhere, for everyone
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                We believe that every Indian deserves access to authentic, high-quality products at fair prices. 
                Our platform connects thousands of verified sellers with millions of buyers, 
                powered by technology that makes shopping feel effortless.
              </p>
              <p className="text-white/60 leading-relaxed">
                From the metro cities to tier-3 towns, NexMart delivers. Our robust logistics network 
                and real-time tracking ensure that your package arrives exactly when promised.
              </p>
              <Link href="/products" className="btn-primary mt-8 inline-flex">
                Shop Now
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/15 flex items-center justify-center">
                  <Shield size={20} className="text-violet-400" />
                </div>
                <h4 className="font-syne font-semibold text-white">Secure Payments</h4>
                <p className="text-xs text-white/40">256-bit SSL encryption on every transaction</p>
              </div>
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-3 mt-6">
                <div className="w-10 h-10 rounded-2xl bg-acid-400/15 flex items-center justify-center">
                  <Zap size={20} className="text-acid-400" />
                </div>
                <h4 className="font-syne font-semibold text-white">Fast Delivery</h4>
                <p className="text-xs text-white/40">Same-day delivery available in 25+ cities</p>
              </div>
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/15 flex items-center justify-center">
                  <Award size={20} className="text-amber-400" />
                </div>
                <h4 className="font-syne font-semibold text-white">Quality Assured</h4>
                <p className="text-xs text-white/40">Every product verified before listing</p>
              </div>
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-3 mt-6">
                <div className="w-10 h-10 rounded-2xl bg-red-400/15 flex items-center justify-center">
                  <Heart size={20} className="text-red-400" />
                </div>
                <h4 className="font-syne font-semibold text-white">24/7 Support</h4>
                <p className="text-xs text-white/40">Always here when you need us</p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-space-800/30 border-y border-white/5">
          <div className="page-container">
            <div className="text-center mb-14">
              <h2 className="font-syne text-4xl font-bold text-white mb-4">What We Stand For</h2>
              <p className="text-white/50 max-w-xl mx-auto">Our values guide every decision we make, from product curation to customer service.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUES.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="glass rounded-2xl p-6 border border-white/5 hover:border-violet-500/30 transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-5 group-hover:bg-violet-500/20 transition-colors">
                    <Icon size={22} className="text-violet-400" />
                  </div>
                  <h3 className="font-syne font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <div className="page-container max-w-2xl mx-auto">
            <h2 className="font-syne text-4xl font-bold text-white mb-4">Ready to experience NexMart?</h2>
            <p className="text-white/50 mb-8">Join over 500,000 happy customers who shop smarter every day.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/products" className="btn-primary px-8 py-3.5 text-base">Browse Products</Link>
              <Link href="/customer/register" className="btn-secondary px-8 py-3.5 text-base">Create Account</Link>
            </div>
          </div>
        </section>
      </div>    </div>
  );
}
