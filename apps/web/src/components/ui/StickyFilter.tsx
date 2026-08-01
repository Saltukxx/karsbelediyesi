import type { ReactNode } from "react";

export function StickyFilter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-[var(--kb-app-header-height)] z-20 -mx-1 rounded-lg border border-kb-border/80 bg-kb-surface/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-kb-surface/90">
      {children}
    </div>
  );
}
