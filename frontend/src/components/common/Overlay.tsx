'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'dialog' | 'drawer' | 'drawer-left';
  busy?: boolean;
  className?: string;
  /**
   * CSS selector for the control that should receive focus when the surface
   * opens (defaults to the first focusable element). Focusing must happen
   * through this prop rather than a native `autoFocus` inside the content:
   * `autoFocus` fires before Radix records the trigger, so Radix would later
   * try to restore focus to an element that no longer exists and drop the
   * user on <body> instead.
   */
  initialFocus?: string;
}

/**
 * One modal contract for every overlay: Radix traps focus while open, closes on
 * Escape, and returns focus to the trigger on close. `busy` holds the surface
 * open through a pending write so a half-finished action cannot be dismissed.
 */
export function Overlay({ open, onClose, title, description, children, footer, variant = 'dialog', busy = false, className, initialFocus }: OverlayProps) {
  const descriptionId = useId();
  const content = useRef<HTMLDivElement | null>(null);

  /**
   * The control that opened this surface, so focus can go back to it on close
   * (WCAG 2.4.3). It has to be tracked while the surface is *closed*: by the
   * time the dialog mounts, focus has already moved inside it, so reading
   * `document.activeElement` at mount is too late.
   */
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    const remember = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body) trigger.current = target;
    };
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-backdrop" />
        <Dialog.Content
          ref={content}
          className={cn('overlay-content', variant === 'dialog' ? 'overlay-dialog' : 'overlay-drawer', variant === 'drawer-left' && 'overlay-drawer-left', className)}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={busy || undefined}
          onOpenAutoFocus={(event) => {
            if (!initialFocus) return;
            const target = content.current?.querySelector<HTMLElement>(initialFocus);
            if (!target) return;
            event.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(event) => {
            // Only override Radix when a live trigger is known; otherwise let
            // its own restoration run.
            const target = trigger.current;
            if (!target?.isConnected) return;
            event.preventDefault();
            target.focus();
          }}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          onInteractOutside={(event) => { if (busy) event.preventDefault(); }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/15 p-4 sm:p-6">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description id={descriptionId} className="mt-2 text-sm text-secondary">{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><button type="button" disabled={busy} className="icon-button -mr-2 -mt-2" aria-label={`Close ${title.toLowerCase()}`}><X size={20} aria-hidden /></button></Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
          {footer && <div className="shrink-0 border-t border-white/15 p-4 sm:p-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
