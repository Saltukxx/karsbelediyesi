import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cardCls, numeralCls, toneChipCls, type Tone } from "@/lib/ui";

/** Eski `tone="default"` kullanımları için geriye dönük eşleme. */
export type StatCardTone = Tone | "default";

function normalizeTone(tone: StatCardTone): Tone {
  return tone === "default" ? "neutral" : tone;
}

/**
 * Tek bir sayısal gösterge.
 *
 * İkon verilirse tonlu bir çip içinde solda durur ve kart yatay düzene geçer;
 * verilmezse etiket ve değer alt alta kalır.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatCardTone;
  icon?: LucideIcon;
}) {
  const t = normalizeTone(tone);
  const govde = (
    <div className="min-w-0">
      <div className={`${numeralCls} text-xl font-semibold text-kb-ink`}>
        {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
      </div>
      <div className="truncate text-[0.8rem] text-kb-muted">{label}</div>
      {hint && <div className="truncate text-xs text-kb-muted/80">{hint}</div>}
    </div>
  );

  if (!Icon) {
    return <div className={`${cardCls} p-3.5`}>{govde}</div>;
  }

  return (
    <div className={`${cardCls} flex items-center gap-3 p-3.5`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneChipCls[t]}`}
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" />
      </span>
      {govde}
    </div>
  );
}
