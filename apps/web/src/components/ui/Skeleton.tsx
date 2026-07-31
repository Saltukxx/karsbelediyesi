import type { CSSProperties } from "react";
import { cardCls } from "@/lib/ui";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-kb-border/60 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className={`${cardCls} p-4`} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <Skeleton key={i} className="mt-2 h-3 w-32" />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className={`${cardCls} p-5`} aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 flex items-end gap-2" style={{ height }}>
        {[60, 85, 45, 95, 70, 55, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className={`${cardCls} overflow-hidden`} aria-hidden="true">
      <div className="flex gap-4 border-b border-kb-border bg-[color:var(--kb-surface)] px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-kb-border/60 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
