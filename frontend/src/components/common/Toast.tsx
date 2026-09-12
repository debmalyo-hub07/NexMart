'use client';

import type { ReactElement } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
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
      className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[9999] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2"
    >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={`${toast.message}. Dismiss notification`}
            className="pointer-events-auto flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/25 bg-space-700 px-4 py-3 text-left"
          >
            {ICONS[toast.type]}
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-white">{toast.message}</span>
            <X size={16} aria-hidden className="shrink-0 text-secondary" />
          </button>
        ))}
    </div>
  );
}
