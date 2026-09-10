'use client';

import { useEffect } from 'react';

/**
 * Modal-surface behavior for drawers and mobile navigation: while `active`,
 * the document cannot scroll behind the surface and Escape closes it. The
 * previous overflow value is restored on every cleanup path (CLAUDE.md §7
 * focus/Escape requirements for disclosures).
 */
export function useDrawerBehavior(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onClose]);
}
