export default function ProductsLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg skeleton" />
          <div className="h-4 w-52 rounded skeleton" />
        </div>
        <div className="h-11 w-36 rounded-xl skeleton" />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-white/5">
          <div className="h-11 w-64 max-w-full rounded-xl skeleton" />
        </div>
        {/* Header row */}
        <div className="flex items-center gap-8 px-4 py-3 border-b border-white/5">
          <div className="h-3 w-36 rounded skeleton" />
          <div className="h-3 w-12 rounded skeleton" />
          <div className="h-3 w-12 rounded skeleton" />
          <div className="h-3 w-14 rounded skeleton" />
          <div className="h-3 w-16 rounded skeleton" />
          <div className="h-3 w-14 rounded skeleton ml-auto" />
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-4 py-3.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-lg skeleton shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-40 rounded skeleton" />
                <div className="h-3 w-24 rounded skeleton" />
              </div>
            </div>
            <div className="h-3.5 w-16 rounded skeleton" />
            <div className="h-3.5 w-12 rounded skeleton" />
            <div className="h-5 w-20 rounded-full skeleton" />
            <div className="h-3.5 w-16 rounded skeleton" />
            <div className="h-3.5 w-14 rounded skeleton ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
