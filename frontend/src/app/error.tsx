'use client';

// Segment-level error boundary. Catches render/data errors in any route that
// doesn't define its own error.tsx and offers a recovery path instead of a blank page.
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console for diagnosis.
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-white/60">
          An unexpected error occurred while loading this page. You can try again, or head back home.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="btn-primary rounded-xl px-5 py-2.5 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
