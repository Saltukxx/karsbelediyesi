import type { ReactNode } from "react";
import { cardCls } from "@/lib/ui";

export function Card({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`${cardCls} ${padding ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-kb-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-kb-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
