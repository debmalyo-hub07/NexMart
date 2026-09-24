import type { Metadata, Viewport } from 'next';
import { Outfit, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './marketplace.css';
import { Providers } from './providers';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';

// Premium pairing: Outfit display + Inter body share the --font-* contract.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'NexMart — Find your kind of everyday',
    template: '%s | NexMart',
  },
  description: 'Browse useful products with clear pricing, reliable checkout, and delivery tracking at NexMart.',
  keywords: ['ecommerce', 'shopping', 'india', 'nexmart', 'online store'],
  authors: [{ name: 'NexMart' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'NexMart - Considered everyday shopping',
    description: 'Browse useful products with clear pricing and delivery tracking.',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#163E64',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-inter bg-space-900 text-white antialiased`} suppressHydrationWarning>
        <Providers>
          <StorefrontLayout>{children}</StorefrontLayout>
        </Providers>
      </body>
    </html>
  );
}
