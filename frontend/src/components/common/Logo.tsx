/** NexMart's N: a clear wordmark companion, with a small marigold accent. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} role="img" aria-label="NexMart">
    <rect x="1" y="1" width="46" height="46" rx="13" fill="var(--brand, #163E64)" />
    <path d="M14 33V15L33 33V15" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="36" cy="12" r="4" fill="var(--marigold, #F3C44E)" />
  </svg>;
}
