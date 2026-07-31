import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Delta } from "@/lib/dashboard-range";
import { dashCardCls, numeralCls, toneChipCls, type Tone } from "./styles";

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
 * çipin renk mantığını ters çevirir. Sol kenardaki lacivert çubuk bütün
 * kartlarda aynıdır; anlam taşıyan renk yalnız çipte kalsın diye.
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

  const tone: Tone =
    changePct === null || changePct === 0
      ? "neutral"
      : (dusukIyi ? azalis : artis)
        ? "success"
        : "danger";

  const Icon = artis ? ArrowUpRight : azalis ? ArrowDownRight : Minus;

  return (
    <div
      className={`${dashCardCls} border-l-2 border-l-kb-navy/70 p-4`}
    >
      <div className="text-[0.8rem] font-medium text-kb-muted">{label}</div>

      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className={`${numeralCls} text-[1.75rem] font-semibold leading-none text-kb-ink`}>
          {formatValue(current, format)}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${toneChipCls[tone]}`}
        >
          <Icon className="h-3 w-3 shrink-0" />
          {changePct === null
            ? "yeni"
            : `%${Math.abs(changePct).toLocaleString("tr-TR")}`}
        </span>
      </div>

      <div className="mt-2 text-xs text-kb-muted">
        {changePct === null
          ? "Önceki dönemde kayıt yok"
          : `Önceki dönem ${formatValue(previous, format)}`}
        {hint && <span className="text-kb-muted/80"> · {hint}</span>}
      </div>
    </div>
  );
}
