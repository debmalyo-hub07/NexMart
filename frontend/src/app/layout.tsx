import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'NexMart — Your Premium Shopping Destination',
    template: '%s | NexMart',
  },
  description: 'Discover millions of products at NexMart. Shop electronics, fashion, home & more with free shipping on orders above ₹999.',
  keywords: ['ecommerce', 'shopping', 'india', 'nexmart', 'online store'],
  authors: [{ name: 'NexMart' }],
  robots: 'index, follow',
  openGraph: {
    title: 'NexMart — Your Premium Shopping Destination',
    description: 'Discover millions of products at unbeatable prices.',
    type: 'website',
    locale: 'en_IN',
  },
};

// Viewport via the canonical Next.js App Router export — a single source of
// truth. (A manual <meta name="viewport"> in <head> duplicated Next's
// auto-injected tag; two viewport metas is non-conformant.)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

import { StorefrontLayout } from '@/components/layout/StorefrontLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-dm bg-space-900 text-white antialiased`} suppressHydrationWarning>
        <Providers>
          <StorefrontLayout>
            {children}
          </StorefrontLayout>
        </Providers>
      </body>
    </html>
  );
}
