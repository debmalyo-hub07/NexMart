'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onCancel, isLoading,
}: ConfirmDialogProps) {
  // Modal semantics (CLAUDE.md §7): Escape closes, and the document must not
  // scroll behind the overlay while a destructive choice is pending.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onCancel();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isLoading, onCancel]);

  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : variant === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600 text-black'
    : 'btn-primary';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[100]" onClick={onCancel} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[min(28rem,calc(100vw-2rem))] glass rounded-3xl p-6 sm:p-8 border border-white/[0.08]"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-xl ${variant === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                <AlertTriangle size={22} aria-hidden />
              </div>
              <div className="flex-1">
                <h3 className="font-syne font-bold text-lg text-white mb-1">{title}</h3>
                <p className="text-sm text-white/60">{description}</p>
              </div>
              <button type="button" onClick={onCancel} aria-label="Close dialog" className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-white/30 hover:text-white/70 transition-colors">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">{cancelLabel}</button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-[background-color,transform,box-shadow] ${btnClass}`}
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
