import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cardCls } from "@/lib/ui";
import type { Delta } from "@/lib/dashboard-range";

type ValueFormat = "sayi" | "tl" | "gun";

function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case "tl":
      return `${Math.round(value).toLocaleString("tr-TR")} ₺`;
    case "gun":
      return `${value.toLocaleString("tr-TR")} gün`;
    case "sayi":
      return value.toLocaleString("tr-TR");
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

/**
 * Tek bir ölçüt: seçili dönemdeki değer ve önceki dönemle karşılaştırma.
 *
 * `dusukIyi` maliyet ve kapanış süresi gibi azalması istenen ölçütlerde
 * renk mantığını ters çevirir.
 */
export function KpiCard({
  label,
  delta,
  format = "sayi",
  dusukIyi = false,
  hint,
}: {
  label: string;
  delta: Delta;
  format?: ValueFormat;
  dusukIyi?: boolean;
  hint?: string;
}) {
  const { current, previous, changePct } = delta;
  const artis = changePct !== null && changePct > 0;
  const azalis = changePct !== null && changePct < 0;
  const iyi = dusukIyi ? azalis : artis;
  const kotu = dusukIyi ? artis : azalis;

  const tone = iyi
    ? "text-kb-success"
    : kotu
      ? "text-kb-danger"
      : "text-kb-muted";

  const Icon = artis ? ArrowUpRight : azalis ? ArrowDownRight : Minus;

  return (
    <div className={`${cardCls} p-4`}>
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-kb-ink">
        {formatValue(current, format)}
      </div>
      <div className={`mt-1.5 flex items-center gap-1 text-xs ${tone}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold tabular-nums">
          {changePct === null
            ? "önceki dönem yok"
            : `%${Math.abs(changePct).toLocaleString("tr-TR")}`}
        </span>
        <span className="truncate text-kb-muted">
          {changePct === null
            ? ""
            : `· önceki ${formatValue(previous, format)}`}
        </span>
      </div>
      {hint && <div className="mt-1 text-xs text-kb-muted">{hint}</div>}
    </div>
  );
}
