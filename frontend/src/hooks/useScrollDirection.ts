'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    // Throttle using rAF for GPU-friendly, jank-free scroll handling
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const currentScrollY = window.scrollY;
      const last = lastScrollYRef.current;

      setIsAtTop(currentScrollY < 10);

      // Only update direction if scroll delta is meaningful (avoids micro-jitter)
      if (Math.abs(currentScrollY - last) > 4) {
        setScrollDirection(currentScrollY > last ? 'down' : 'up');
        lastScrollYRef.current = currentScrollY;
      }

      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    // Initialize with current scroll position on mount
    lastScrollYRef.current = window.scrollY;
    setIsAtTop(window.scrollY < 10);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [handleScroll]);

  return { scrollDirection, isAtTop };
}
