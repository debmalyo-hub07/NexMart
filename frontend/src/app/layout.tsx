import type { Metadata } from 'next';
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

import { StorefrontLayout } from '@/components/layout/StorefrontLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
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
