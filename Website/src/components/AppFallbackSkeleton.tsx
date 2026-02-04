export function AppFallbackSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="h-8 w-56 bg-white/10 rounded mb-6 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse mb-3" />
              <div className="h-4 bg-white/10 rounded w-10/12 mb-2 animate-pulse" />
              <div className="h-3 bg-white/10 rounded w-6/12 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
