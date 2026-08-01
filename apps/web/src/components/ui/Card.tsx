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
  divider = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Başlığın altına ince ayırıcı çizgi ekler; grafik ve içerik kartlarında. */
  divider?: boolean;
}) {
  return (
    <div
      className={
        divider
          ? "mb-4 border-b border-kb-border/70 pb-4"
          : "mb-4"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[0.8rem] text-kb-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
