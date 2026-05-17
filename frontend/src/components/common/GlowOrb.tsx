'use client';

import { cn } from '@/lib/utils';

interface GlowOrbProps {
  color?: 'violet' | 'acid' | 'blue';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  intensity?: number;
}

const colorMap = {
  violet: 'rgba(124, 58, 237',
  acid: 'rgba(34, 213, 141',
  blue: 'rgba(59, 130, 246',
};

const sizeMap = {
  sm: 200,
  md: 400,
  lg: 600,
  xl: 900,
};

export function GlowOrb({ color = 'violet', size = 'md', className, intensity = 0.2 }: GlowOrbProps) {
  const px = sizeMap[size];
  const rgb = colorMap[color];

  return (
    <div
      className={cn('absolute rounded-full pointer-events-none animate-pulse-glow', className)}
      style={{
        width: px,
        height: px,
        background: `radial-gradient(ellipse at center, ${rgb}, ${intensity}) 0%, transparent 70%)`,
        filter: `blur(${px / 3}px)`,
      }}
    />
  );
}
