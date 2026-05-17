export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="h-9 w-36 rounded-xl skeleton mb-3" />
          <div className="h-4 w-72 rounded-lg skeleton" />
        </div>
        <div className="flex justify-end">
          <div className="w-full max-w-[650px] h-28 rounded-2xl skeleton" />
        </div>
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-6 border border-white/5 h-28 skeleton" />
        ))}
      </div>
      {/* Chart */}
      <div className="glass rounded-2xl h-72 border border-white/5 skeleton" />
      {/* Table */}
      <div className="glass rounded-2xl h-64 border border-white/5 skeleton" />
    </div>
  );
}
