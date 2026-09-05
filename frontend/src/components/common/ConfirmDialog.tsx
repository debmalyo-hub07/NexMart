'use client';

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
            className="fixed inset-0 bg-black/70 z-[100]" onClick={onCancel} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md glass rounded-3xl p-8 border border-white/[0.08]"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-xl ${variant === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-syne font-bold text-lg text-white mb-1">{title}</h3>
                <p className="text-sm text-white/60">{description}</p>
              </div>
              <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="btn-secondary flex-1 justify-center">{cancelLabel}</button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-[background-color,transform,box-shadow] ${btnClass}`}
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
