export default function Loading() {
    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Header skeleton */}
            <div className="h-16 bg-brand-surface border-b border-brand-border animate-pulse" />

            <div className="max-w-container mx-auto px-6 py-8">
                {/* Title skeleton */}
                <div className="h-8 w-64 bg-brand-surface-2 rounded-xl mb-6 animate-pulse" />
                <div className="h-4 w-96 bg-brand-surface-2 rounded-lg mb-8 animate-pulse" />

                {/* Cards skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-brand-surface border border-brand-border rounded-2xl p-6 animate-pulse">
                            <div className="h-4 w-20 bg-brand-surface-2 rounded mb-3" />
                            <div className="h-7 w-32 bg-brand-surface-2 rounded mb-2" />
                            <div className="h-3 w-16 bg-brand-surface-2 rounded" />
                        </div>
                    ))}
                </div>

                {/* Table skeleton */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden animate-pulse">
                    <div className="p-4 border-b border-brand-border flex gap-3">
                        <div className="h-10 w-64 bg-brand-surface-2 rounded-xl" />
                        <div className="h-10 w-32 bg-brand-surface-2 rounded-xl" />
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-4 border-b border-brand-border/50 flex gap-4 items-center">
                            <div className="h-4 w-24 bg-brand-surface-2 rounded" />
                            <div className="h-4 w-40 bg-brand-surface-2 rounded" />
                            <div className="h-4 w-20 bg-brand-surface-2 rounded" />
                            <div className="h-4 w-16 bg-brand-surface-2 rounded" />
                            <div className="h-4 w-24 bg-brand-surface-2 rounded ml-auto" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
