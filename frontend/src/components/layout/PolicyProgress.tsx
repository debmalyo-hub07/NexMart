'use client';

import { useEffect, useState } from 'react';

/** Thin reading-progress bar for long policy pages. Compositor-only transform. */
export function PolicyProgress() {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setScale(height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="policy-progress" aria-hidden>
      <span style={{ transform: `scaleX(${scale})` }} />
    </div>
  );
}
