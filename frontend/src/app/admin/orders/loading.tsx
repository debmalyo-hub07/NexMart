export default function OrdersLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg skeleton" />
          <div className="h-4 w-48 rounded skeleton" />
        </div>
        <div className="h-10 w-40 rounded-xl skeleton" />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-8 px-4 py-3 border-b border-white/5">
          <div className="h-3 w-20 rounded skeleton" />
          <div className="h-3 w-20 rounded skeleton" />
          <div className="h-3 w-16 rounded skeleton" />
          <div className="h-3 w-16 rounded skeleton" />
          <div className="h-3 w-16 rounded skeleton" />
          <div className="h-3 w-14 rounded skeleton" />
          <div className="h-3 w-14 rounded skeleton ml-auto" />
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-4 py-3.5 border-b border-white/5 last:border-0">
            <div className="h-3.5 w-24 rounded skeleton" />
            <div className="h-3.5 w-32 rounded skeleton flex-1 min-w-0" />
            <div className="h-3.5 w-16 rounded skeleton" />
            <div className="h-3.5 w-16 rounded skeleton" />
            <div className="h-5 w-20 rounded-full skeleton" />
            <div className="h-3.5 w-14 rounded skeleton" />
            <div className="h-3.5 w-20 rounded skeleton ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
