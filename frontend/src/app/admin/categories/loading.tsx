export default function CategoriesLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg skeleton" />
          <div className="h-4 w-64 rounded skeleton" />
        </div>
        <div className="h-11 w-40 rounded-xl skeleton" />
      </div>

      {/* Search */}
      <div className="h-11 w-full rounded-xl skeleton" />

      {/* Category tree */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl border border-white/5 overflow-hidden">
            {/* Parent row */}
            <div className="flex items-center gap-4 p-4">
              <div className="h-5 w-5 rounded skeleton shrink-0" />
              <div className="h-8 w-8 rounded-lg skeleton shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-4 w-40 rounded skeleton" />
                <div className="h-3 w-56 rounded skeleton" />
              </div>
              <div className="h-8 w-24 rounded-lg skeleton" />
            </div>
            {/* Expanded children (first card only, for tree shape) */}
            {i === 0 && (
              <div className="border-t border-white/5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0">
                    <div className="w-5 shrink-0" />
                    <div className="h-2 w-2 rounded-full skeleton shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="h-3.5 w-32 rounded skeleton" />
                      <div className="h-2.5 w-24 rounded skeleton" />
                    </div>
                    <div className="h-7 w-16 rounded-lg skeleton" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
