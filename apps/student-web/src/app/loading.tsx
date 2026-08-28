export default function StudentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-40 rounded-2xl bg-surface-inset" />
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-inset" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-48 rounded-2xl bg-surface-inset" />
        <div className="h-48 rounded-2xl bg-surface-inset" />
      </div>
    </div>
  );
}
