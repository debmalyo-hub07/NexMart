export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-space-900">
      <div className="fixed top-0 left-0 right-0 h-[72px] z-50 glass border-b border-white/5" />
      <div className="pt-[72px]">
        {/* Search header skeleton */}
        <div className="border-b border-white/5 bg-space-800/40 py-10">
          <div className="page-container">
            <div className="flex gap-3 max-w-2xl mx-auto">
              <div className="h-14 flex-1 rounded-xl skeleton" />
              <div className="h-14 w-24 rounded-xl skeleton" />
            </div>
          </div>
        </div>
        {/* Results skeleton */}
        <div className="page-container py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl skeleton h-72" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
