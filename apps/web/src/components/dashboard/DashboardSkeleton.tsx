import { Skeleton } from "@/components/ui/Skeleton";
import { cardCls } from "@/lib/ui";

function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className={`${cardCls} p-4`} aria-hidden="true">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-16" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <Skeleton key={i} className="mt-2 h-3 w-24" />
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className={`${cardCls} p-5`} aria-hidden="true">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-56" />
      <div className="mt-5 flex items-end gap-2" style={{ height }}>
        {[62, 88, 45, 96, 71, 54, 82, 68].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Dashboard gövdesinin iskeleti. Hem `loading.tsx` hem de tarih aralığı
 * değişiminde devreye giren Suspense sınırı bunu kullanır.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <section className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>

      <ChartSkeleton height={260} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
      </div>
    </div>
  );
}
