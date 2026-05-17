'use client';

import { motion, AnimatePresence } from 'framer-motion';

export function FullPageLoader({ show = true }: { show?: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] bg-space-900 flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-6">
            {/* Animated logo */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl bg-violet-gradient flex items-center justify-center glow-violet"
            >
              <span className="text-white font-syne font-bold text-2xl">N</span>
            </motion.div>

            {/* Loading bar */}
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-violet-gradient rounded-full"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <p className="font-syne text-sm text-white/40 tracking-widest uppercase">
              Loading NexMart
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
