'use client';

import { ReactNode, useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Smooth scrolling is a desktop storefront enhancement. Avoid installing
    // a RAF-driven scroll hijack on touch, low-power, or reduced-motion devices.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse), (max-width: 767px), (update: slow)').matches;
    if (reduceMotion || coarsePointer) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const updateLenis = (time: number) => {
      if (!document.hidden) lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    const onVisibilityChange = () => {
      if (document.hidden) lenis.stop();
      else lenis.start();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      gsap.ticker.remove(updateLenis);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
