import Link from "next/link";
import { buttonCls } from "@/lib/ui";
import {
  RANGE_PRESETS,
  trDayKey,
  type DashboardRange,
} from "@/lib/dashboard-range";

/**
 * Tarih aralığı seçici. Tamamen URL üzerinden çalışır: hazır aralıklar birer
 * bağlantı, özel aralık ise GET formudur. Bu sayede JavaScript olmadan da
 * çalışır ve sunucu bileşeni olarak kalabilir.
 */
export function RangePicker({ range }: { range: DashboardRange }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => {
          const aktif = range.preset === p.id;
          return (
            <Link
              key={p.id}
              href={`/?aralik=${p.id}`}
              aria-current={aktif ? "true" : undefined}
              className={
                aktif
                  ? `${buttonCls("primary", "sm")} pointer-events-none`
                  : buttonCls("secondary", "sm")
              }
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <form method="get" action="/" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aralik" value="ozel" />
        <div>
          <label
            htmlFor="range-bas"
            className="block text-[0.65rem] font-semibold uppercase tracking-wide text-kb-muted"
          >
            Başlangıç
          </label>
          <input
            id="range-bas"
            type="date"
            name="bas"
            defaultValue={trDayKey(range.bas)}
            max={trDayKey(new Date())}
            className="mt-1 rounded-md border border-kb-border bg-white px-2.5 py-1.5 text-sm text-kb-ink focus:border-kb-navy focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
          />
        </div>
        <div>
          <label
            htmlFor="range-bit"
            className="block text-[0.65rem] font-semibold uppercase tracking-wide text-kb-muted"
          >
            Bitiş
          </label>
          <input
            id="range-bit"
            type="date"
            name="bit"
            defaultValue={trDayKey(range.bit)}
            max={trDayKey(new Date())}
            className="mt-1 rounded-md border border-kb-border bg-white px-2.5 py-1.5 text-sm text-kb-ink focus:border-kb-navy focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
          />
        </div>
        <button type="submit" className={buttonCls("secondary", "sm")}>
          Uygula
        </button>
      </form>
    </div>
  );
}
