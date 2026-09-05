// Global route-segment fallback. Next.js uses the nearest ancestor loading.tsx,
// so this covers every segment that doesn't define its own.
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-xl skeleton" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="rounded-2xl h-28 skeleton" />
        ))}
      </div>
      <div className="rounded-2xl h-72 skeleton" />
    </div>
  );
}
