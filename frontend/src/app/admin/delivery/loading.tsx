export default function DeliveryLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg skeleton" />
        <div className="h-4 w-56 rounded skeleton" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl skeleton" />
              <div className="h-3.5 w-28 rounded skeleton" />
            </div>
            <div className="h-8 w-16 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Agent management card with tabs + list */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 flex justify-center py-4">
              <div className="h-4 w-32 rounded skeleton" />
            </div>
          ))}
        </div>
        {/* Rows */}
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 w-36 rounded skeleton" />
                <div className="h-3 w-48 rounded skeleton" />
              </div>
              <div className="h-3.5 w-28 rounded skeleton" />
              <div className="h-3.5 w-20 rounded skeleton" />
              <div className="h-5 w-20 rounded-full skeleton" />
              <div className="h-3.5 w-16 rounded skeleton" />
              <div className="h-7 w-24 rounded-lg skeleton" />
            </div>
          ))}
        </div>
      </div>

      {/* Assign deliveries list */}
      <div className="space-y-4">
        <div className="h-5 w-40 rounded skeleton" />
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-4 py-3.5">
              <div className="h-3.5 w-24 rounded skeleton" />
              <div className="h-3.5 w-32 rounded skeleton flex-1 min-w-0" />
              <div className="h-3.5 w-24 rounded skeleton" />
              <div className="h-5 w-20 rounded-full skeleton" />
              <div className="h-3.5 w-28 rounded skeleton" />
              <div className="h-3.5 w-14 rounded skeleton" />
              <div className="h-8 w-28 rounded-lg skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
