'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { Overlay } from '@/components/common/Overlay';
import { cn } from '@/lib/utils';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);
  const touchStart = useRef(0);
  const active = images.includes(selected) ? selected : images[0];
  const index = Math.max(0, images.indexOf(active));
  const move = (direction: number) => setSelected(images[(index + direction + images.length) % images.length]);
  const controls = images.length > 1 && <div className="flex items-center justify-between gap-4">
    <button type="button" className="icon-button border border-white/25" aria-label="Previous product image" onClick={() => move(-1)}><ChevronLeft size={20} aria-hidden /></button>
    <p role="status" className="text-sm text-secondary">Image {index + 1} of {images.length}</p>
    <button type="button" className="icon-button border border-white/25" aria-label="Next product image" onClick={() => move(1)}><ChevronRight size={20} aria-hidden /></button>
  </div>;
  return <div className="space-y-3">
    <button type="button" disabled={!active} onClick={() => setOpen(true)} aria-label={`Enlarge ${name}, image ${index + 1}`} className="product-stage relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/15"
      onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={event => { const distance = touchStart.current - event.changedTouches[0].clientX; if (images.length > 1 && Math.abs(distance) > 50) move(distance > 0 ? 1 : -1); }}>
      <ProductImage src={active} alt={`${name}, image ${index + 1}`} sizes="(max-width: 1023px) calc(100vw - 32px), 580px" priority className="p-4 sm:p-7" />
      {active && <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-space-900 px-3 text-xs text-white"><ZoomIn size={17} aria-hidden />Enlarge</span>}
    </button>
    {controls}
    {images.length > 1 && <div className="flex gap-2 overflow-x-auto p-1" aria-label="Product image thumbnails">{images.map((src, i) => <button key={`${src}-${i}`} type="button" onClick={() => setSelected(src)} aria-label={`View image ${i + 1} of ${name}`} aria-pressed={i === index} className={cn('product-stage relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', i === index ? 'border-violet-300' : 'border-transparent')}><ProductImage src={src} alt="" sizes="64px" className="p-1" /></button>)}</div>}
    <Overlay open={open} onClose={() => setOpen(false)} title={name} className="max-w-4xl" footer={controls}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="product-stage relative h-[min(65dvh,640px)] w-full rounded-lg" tabIndex={-1}
        onKeyDown={event => { if (images.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}
        onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={event => { const distance = touchStart.current - event.changedTouches[0].clientX; if (images.length > 1 && Math.abs(distance) > 50) move(distance > 0 ? 1 : -1); }}>
        <ProductImage src={active} alt={`${name}, image ${index + 1}`} sizes="(max-width: 900px) 90vw, 850px" className="p-3" />
      </div>
    </Overlay>
  </div>;
}
