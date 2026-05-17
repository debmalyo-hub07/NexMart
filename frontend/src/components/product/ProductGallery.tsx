'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  images: string[];
  name: string;
}

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!images.length) return (
    <div className="w-full aspect-square glass rounded-3xl flex items-center justify-center text-white/20">
      No image
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {/* Main image */}
        <div
          className="relative w-full aspect-square glass rounded-3xl overflow-hidden cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <Image src={images[activeIndex]} alt={`${name} - image ${activeIndex + 1}`}
                fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute top-3 right-3 p-2 glass rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn size={16} className="text-white/70" />
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 glass rounded-xl hover:bg-white/10 transition-colors"
              ><ChevronLeft size={16} /></button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 glass rounded-xl hover:bg-white/10 transition-colors"
              ><ChevronRight size={16} /></button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn('relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all',
                  i === activeIndex ? 'border-violet-500 glow-violet' : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <Image src={img} alt={`Thumbnail ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-8"
            onClick={() => setLightboxOpen(false)}
          >
            <button className="absolute top-4 right-4 p-3 glass rounded-xl text-white/70 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="relative max-w-3xl max-h-[80vh] w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image src={images[activeIndex]} alt={name} fill className="object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
