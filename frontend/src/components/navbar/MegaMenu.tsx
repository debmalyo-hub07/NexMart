'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Category {
  name: string;
  slug: string;
  icon: string;
  sub: string[];
}

// Stable variants at module level
const menuVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98 },
};
const menuTransition = { duration: 0.18, ease: 'easeOut' as const };

export const MegaMenu = memo(function MegaMenu({
  categories,
  onClose,
}: { categories: Category[]; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<Category | undefined>(categories[0]);

  // Sync when categories load asynchronously
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const handleCategoryEnter = useCallback((cat: Category) => {
    setActiveCategory(cat);
  }, []);

  // Don't render until categories are available
  if (!activeCategory) return null;

  return (
    <div className="absolute top-full left-0 pt-3 w-[580px] z-50">
      <motion.div
        variants={menuVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={menuTransition}
        className="w-full bg-[#111116]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_0_80px_-20px_rgba(124,58,237,0.3)] overflow-hidden"
      >
        <div className="flex min-h-[340px]">
          {/* Category list */}
          <div className="w-[40%] p-3 border-r border-white/5 bg-black/30 overflow-y-auto">
            {categories.map((cat) => {
              const isActive = activeCategory.slug === cat.slug;
              return (
                <button
                  key={cat.slug}
                  onMouseEnter={() => handleCategoryEnter(cat)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 text-white border border-violet-500/40 shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                  suppressHydrationWarning
                >
                  <span className="text-lg leading-none">{cat.icon}</span>
                  <span className="font-medium">{cat.name}</span>
                  <ChevronRight size={13} className="ml-auto opacity-40 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Sub-categories panel */}
          <div className="w-[60%] p-6 bg-space-800/80">
            <h3 className="text-xs font-bold text-white/50 tracking-widest uppercase mb-4 pb-2 border-b border-white/8 flex items-center gap-2">
              <span className="text-lg">{activeCategory.icon}</span>
              {activeCategory.name}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {activeCategory.sub.map((sub) => (
                <Link
                  key={sub}
                  href={`/categories/${activeCategory.slug}?sub=${sub.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={onClose}
                  className="group flex items-center px-2 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500/0 group-hover:bg-violet-500 mr-2.5 transition-colors shrink-0" />
                  {sub}
                </Link>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <Link
                href={`/categories/${activeCategory.slug}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-gradient-to-r hover:from-violet-600/20 hover:to-fuchsia-600/20 border border-white/10 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all group"
              >
                Explore all {activeCategory.name} <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
