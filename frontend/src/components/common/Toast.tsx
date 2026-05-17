'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function Toast() {
  const { toast, clearToast } = useUIStore();

  const icons = {
    success: <CheckCircle size={18} className="text-acid-400" />,
    error: <XCircle size={18} className="text-red-400" />,
    info: <Info size={18} className="text-violet-400" />,
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] glass rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-glow-violet border border-white/10 min-w-[280px]"
        >
          {icons[toast.type]}
          <span className="text-sm text-white font-medium">{toast.message}</span>
          <button onClick={clearToast} className="ml-auto text-white/40 hover:text-white/70 transition-colors">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
