import { useId } from 'react';

/**
 * NexMart logo mark — the "Orbit-N" monogram.
 *
 * Two bold gradient stems carry the letter N; the diagonal becomes a thin
 * orbital arc with an acid-green node traveling on it — the homepage hero
 * (wireframe sphere + orbiting rings + particles) miniaturized into a mark.
 * The node sits in the action color: the product in orbit, the thing you're
 * about to buy.
 *
 * All colors are registered tokens (CLAUDE.md §2.1): violet-500 #8B5CF6 →
 * fuchsia-500 #D946EF brand gradient, violet-300 #C084FC arc, acid-400
 * #22D58D node. Wordmarks stay in their owners' markup.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="NexMart"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      {/* N stems — the brand gradient carries the weight */}
      <path d="M11 10 V38" stroke={`url(#${gradientId})`} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M37 10 V38" stroke={`url(#${gradientId})`} strokeWidth="6.5" strokeLinecap="round" />
      {/* The diagonal as an orbital arc — the hero's orbiting rings, miniaturized */}
      <path d="M14 11 Q36 14 34 37" stroke="#C084FC" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round" />
      {/* The node — the product in orbit, in the action color */}
      <circle cx="31.8" cy="21.8" r="4" fill="#22D58D" />
    </svg>
  );
}
