'use client';

import type { ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { useUIStore, type ToastItem } from '@/store/uiStore';

const ICONS: Record<ToastItem['type'], ReactElement> = {
  success: <CheckCircle size={18} className="shrink-0 text-acid-400" />,
  error: <XCircle size={18} className="shrink-0 text-red-400" />,
  info: <Info size={18} className="shrink-0 text-violet-400" />,
};

export function Toast() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            onClick={() => dismissToast(toast.id)}
            className="glass pointer-events-auto flex min-w-[280px] max-w-sm items-center gap-3 rounded-2xl border border-white/10 px-5 py-3.5 text-left shadow-glow-violet"
          >
            {ICONS[toast.type]}
            <span className="break-words text-sm font-medium text-white">{toast.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
