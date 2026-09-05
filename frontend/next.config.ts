import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Verification builds (CI, pre-commit checks) can target a separate directory
  // so they never clobber the dev server's .next cache mid-session:
  //   NEXT_DIST_DIR=.next-verify npm run build
  // Without the env var, everything behaves exactly as before.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  // Optimize package imports for faster compile & load times
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'gsap',
      'framer-motion',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast'
    ],
  },

  // Optimized image handling
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`,
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24h
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  },

  // Enable gzip compression on dev server responses
  compress: true,

  // Reduce client JS by externalising heavy server-only packages
  serverExternalPackages: [],

  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
    ];
  },

};

export default nextConfig;
