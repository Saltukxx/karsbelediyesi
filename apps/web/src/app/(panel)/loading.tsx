import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function PanelLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-kb-border pb-5">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
