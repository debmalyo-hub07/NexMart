'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorOuterRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [hoverType, setHoverType] = useState<'normal' | 'view' | 'drag'>('normal');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Disable custom cursor on touch/mobile devices
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    const cursor = cursorRef.current;
    const cursorOuter = cursorOuterRef.current;
    if (!cursor || !cursorOuter) return;

    // Enable global suppression of default cursors via HTML class
    document.documentElement.classList.add('custom-cursor-active');

    // Set initial positions with pivot centered
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    gsap.set(cursorOuter, { xPercent: -50, yPercent: -50 });

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const mouse = { x: pos.x, y: pos.y };

    const setCursorX = gsap.quickSetter(cursor, 'x', 'px');
    const setCursorY = gsap.quickSetter(cursor, 'y', 'px');
    const setOuterX = gsap.quickSetter(cursorOuter, 'x', 'px');
    const setOuterY = gsap.quickSetter(cursorOuter, 'y', 'px');

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Lerp logic for outer circle lag
    const dt = 0.15; // lerp factor
    const tick = () => {
      pos.x += (mouse.x - pos.x) * dt;
      pos.y += (mouse.y - pos.y) * dt;

      setCursorX(mouse.x);
      setCursorY(mouse.y);
      setOuterX(pos.x);
      setOuterY(pos.y);
    };

    gsap.ticker.add(tick);

    // Hover state detection using delegation
    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest('a, button, [role="button"], input, select, textarea, .interactive-hover');
      const productImage = target.closest('.product-image-hover');
      const carouselDrag = target.closest('.carousel-drag-hover');

      if (productImage) {
        setHovered(true);
        setHoverType('view');
      } else if (carouselDrag) {
        setHovered(true);
        setHoverType('drag');
      } else if (interactive) {
        setHovered(true);
        setHoverType('normal');
      } else {
        setHovered(false);
      }
    };

    window.addEventListener('mouseover', onMouseOver, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', onMouseOver);
      gsap.ticker.remove(tick);
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, []);

  return (
    <>
      {/* Inner Dot Wrapper (moved by GSAP — no CSS transitions here) */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden lg:block w-fit h-fit"
      >
        {/* Inner Dot Visuals (transitioned smoothly via CSS) */}
        <div
          className={`w-3 h-3 bg-violet-500 rounded-full transition-transform duration-200 ease-out ${
            hovered ? 'scale-0' : 'scale-100'
          }`}
        />
      </div>

      {/* Outer Circle Wrapper (moved by GSAP — no CSS transitions here) */}
      <div
        ref={cursorOuterRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998] hidden lg:block w-fit h-fit"
      >
        {/* Outer Circle Visuals (transitioned smoothly via CSS) */}
        <div
          className={`rounded-full flex items-center justify-center font-bold text-[8px] uppercase tracking-wider text-black bg-transparent border border-violet-500 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out ${
            hovered
              ? hoverType === 'view'
                ? 'w-14 h-14 bg-white/95 border-transparent scale-100 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                : hoverType === 'drag'
                ? 'w-14 h-14 bg-white/95 border-transparent scale-100 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                : 'w-10 h-10 border-violet-400 bg-violet-500/10 scale-100'
              : 'w-6 h-6 border-violet-500/40 scale-75'
          }`}
        >
          {hovered && hoverType === 'view' && <span className="text-violet-950 font-outfit font-bold animate-fade-in">View</span>}
          {hovered && hoverType === 'drag' && <span className="text-violet-950 text-xs animate-fade-in">↔</span>}
        </div>
      </div>
    </>
  );
}
