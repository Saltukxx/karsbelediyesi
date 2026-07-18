import type { ReactNode } from "react";
import { cardCls } from "@/lib/ui";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "navy" | "warning" | "danger" | "success";
}) {
  const valueTone =
    tone === "navy"
      ? "text-kb-navy"
      : tone === "warning"
        ? "text-kb-warning"
        : tone === "danger"
          ? "text-kb-danger"
          : tone === "success"
            ? "text-kb-success"
            : "text-kb-ink";

  return (
    <div className={`${cardCls} p-4`}>
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueTone}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-kb-muted">{hint}</div>}
    </div>
  );
}
