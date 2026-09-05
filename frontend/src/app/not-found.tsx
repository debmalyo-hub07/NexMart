import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-5">
        <p className="font-mono text-sm text-violet-400">404</p>
        <h1 className="font-syne text-4xl font-bold text-white">Lost in space</h1>
        <p className="text-sm text-white/60">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/products" className="btn-primary text-sm inline-flex items-center gap-2">
            <Search size={15} /> Browse products
          </Link>
          <Link href="/" className="btn-secondary text-sm inline-flex items-center gap-2">
            <Home size={15} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
