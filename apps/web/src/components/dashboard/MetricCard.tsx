import type { LucideIcon } from "lucide-react";
import { dashCardCls, numeralCls, toneChipCls, type Tone } from "./styles";

/**
 * Anlık durum göstergesi. Paylaşılan `ui/StatCard` yerine dashboard'da bu
 * kullanılır; /komuta ekranı StatCard'a bağlı olduğu için o dosya değişmez.
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className={`${dashCardCls} flex items-center gap-3 p-3.5`}>
      {Icon && (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneChipCls[tone]}`}
        >
          <Icon className="h-[1.05rem] w-[1.05rem]" />
        </span>
      )}
      <div className="min-w-0">
        <div className={`${numeralCls} text-xl font-semibold text-kb-ink`}>
          {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
        </div>
        <div className="truncate text-[0.8rem] text-kb-muted">{label}</div>
        {hint && (
          <div className="truncate text-xs text-kb-muted/80">{hint}</div>
        )}
      </div>
    </div>
  );
}
