export default function AnalyticsLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg skeleton" />
          <div className="h-4 w-56 rounded skeleton" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-12 rounded-lg skeleton" />
          ))}
        </div>
      </div>

      {/* Revenue chart */}
      <div className="glass rounded-2xl p-6 border border-white/5">
        <div className="h-4 w-44 rounded skeleton mb-6" />
        <div className="w-full h-[260px] rounded-xl skeleton" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order status chart */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <div className="h-4 w-40 rounded skeleton mb-6" />
          <div className="w-full h-[220px] rounded-xl skeleton" />
        </div>

        {/* Top products list */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <div className="h-4 w-52 rounded skeleton mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-3 rounded skeleton shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 w-2/3 rounded skeleton" />
                  <div className="h-1.5 w-full rounded-full skeleton" />
                </div>
                <div className="w-6 h-3 rounded skeleton shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
