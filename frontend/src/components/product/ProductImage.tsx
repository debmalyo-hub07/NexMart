'use client';

import Image, { type ImageLoaderProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function cloudinaryLoader({ src, width, quality }: ImageLoaderProps) {
  return src.replace('/image/upload/', `/image/upload/f_auto,q_${quality ?? 80},c_limit,w_${Math.min(width, 1600)}/`);
}

export function ProductImage({ src, alt, sizes, priority = false, className }: { src?: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const cloudinary = !!src?.startsWith('https://res.cloudinary.com/') && src.includes('/image/upload/');
  const allowed = cloudinary || src?.startsWith('/images/');
  if (!src || !allowed || failedSrc === src) return <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-space-500" role="img" aria-label={`${alt}: image unavailable`}><ImageOff size={28} aria-hidden /><span>Image unavailable</span></div>;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} loader={cloudinary ? cloudinaryLoader : undefined} className={cn('object-contain', className)} onError={() => setFailedSrc(src)} />;
}
