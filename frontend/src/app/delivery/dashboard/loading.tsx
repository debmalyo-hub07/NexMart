export default function DeliveryDashboardLoading() {
  return (
    <div className="min-h-screen bg-space-900">
      <div className="glass border-b border-white/5 h-16 sticky top-0 z-10 skeleton" />
      <div className="page-container py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 h-28 skeleton border border-white/5" />
          ))}
        </div>
        <div className="glass rounded-2xl h-72 border border-white/5 skeleton" />
      </div>
    </div>
  );
}
