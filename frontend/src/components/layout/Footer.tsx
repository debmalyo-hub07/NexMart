'use client';

import Link from 'next/link';
import { memo } from 'react';
import { Mail, Phone, MapPin, Twitter, Instagram, Github, Youtube } from 'lucide-react';

const footerLinks = {
  Shop: [
    { label: 'All Products', href: '/products' },
    { label: 'Electronics', href: '/categories/electronics' },
    { label: 'Fashion', href: '/categories/fashion' },
    { label: 'Home & Living', href: '/categories/home-living' },
    { label: 'Books', href: '/categories/books' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Track Order', href: '/orders' },
    { label: 'Returns', href: '/returns' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'FAQs', href: '/faq' },
  ],
  Company: [
    { label: 'About NexMart', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

const socials = [
  { Icon: Twitter, href: '#', label: 'Twitter' },
  { Icon: Instagram, href: '#', label: 'Instagram' },
  { Icon: Youtube, href: '#', label: 'YouTube' },
  { Icon: Github, href: '#', label: 'GitHub' },
];

const paymentBadges = ['Razorpay', 'UPI', 'Visa', 'Mastercard', 'COD'];

export const Footer = memo(function Footer() {
  return (
    <footer className="border-t border-white/5 bg-space-900 mt-auto">
      {/* Newsletter */}
      <div className="border-b border-white/5">
        <div className="page-container py-12">
          <div className="glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-glow-violet opacity-30 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h3 className="font-syne text-2xl font-bold text-white mb-2">
                  Get exclusive deals &amp; updates
                </h3>
                <p className="text-white/60 text-sm">
                  Join 50,000+ shoppers who get our weekly newsletter with the best deals.
                </p>
              </div>
              {/*
                suppressHydrationWarning on inputs/buttons because browser extensions
                (autofill, password managers) may inject fdprocessedid attributes
                after hydration, causing React warnings.
              */}
              <form
                className="flex gap-3 w-full md:w-auto"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="input flex-1 md:w-72"
                  suppressHydrationWarning
                />
                <button type="submit" className="btn-primary shrink-0" suppressHydrationWarning>
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="page-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-gradient flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-syne font-bold text-xl gradient-text">NexMart</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              India&apos;s next-generation shopping destination. Millions of products,
              unbeatable prices, and lightning-fast delivery — all in one place.
            </p>
            <div className="space-y-2 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-violet-400" />
                <span>support@nexmart.in</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-violet-400" />
                <span>1800-NEXMART (toll-free)</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-violet-400" />
                <span>Bengaluru, Karnataka, India</span>
              </div>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-syne font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-white/5">
        <div className="page-container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          {/*
            suppressHydrationWarning: new Date().getFullYear() can differ between
            SSR (build time) and client (runtime) causing a hydration mismatch.
            This is the correct, minimal fix — only suppresses on the single span.
          */}
          <p className="text-xs text-white/30" suppressHydrationWarning>
            © {new Date().getFullYear()} NexMart Technologies Pvt. Ltd. All rights reserved.
          </p>

          {/* Payment badges */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 mr-1">Accepted payments:</span>
            {paymentBadges.map((badge) => (
              <span
                key={badge}
                className="px-2 py-1 rounded-md glass border border-white/5 text-[10px] font-medium text-white/50"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Socials */}
          <div className="flex items-center gap-3">
            {socials.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="p-2 rounded-lg glass hover:border-violet-500/30 transition-colors text-white/40 hover:text-white"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
});
