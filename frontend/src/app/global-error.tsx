'use client';

// Root-level error boundary — catches errors thrown in the root layout itself.
// Must render its own <html> and <body> because it replaces the whole tree.
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#050508', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div role="alert" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem 1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Application error</h1>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', maxWidth: '28rem' }}>
            A critical error occurred. Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{ minHeight: '44px', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.65rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
