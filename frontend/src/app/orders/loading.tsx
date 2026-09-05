export default function OrdersLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5 animate-pulse">
      <div className="h-8 w-40 rounded-xl skeleton mb-4" />
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="rounded-2xl h-28 skeleton border border-white/5" />
      ))}
    </div>
  );
}
