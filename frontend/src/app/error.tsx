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
    <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold text-white">This page could not be loaded</h1>
        <p className="text-sm text-secondary">
          An unexpected error occurred while loading this page. You can try again, or head back home.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Try again
          </button>
          <Link
            href="/"
            className="btn-secondary"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
