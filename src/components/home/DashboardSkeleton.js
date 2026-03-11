export default function DashboardSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-6">
      <div className="h-8 w-52 rounded-lg skeleton-shimmer" />
      <div className="h-4 w-32 rounded skeleton-shimmer" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
      <div className="h-16 rounded-2xl skeleton-shimmer" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 rounded-2xl skeleton-shimmer" />
        <div className="h-14 rounded-2xl skeleton-shimmer" />
      </div>
      <div className="h-20 rounded-2xl skeleton-shimmer" />
    </div>
  );
}
