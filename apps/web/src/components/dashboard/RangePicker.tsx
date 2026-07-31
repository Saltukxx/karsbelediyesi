"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { buttonCls } from "@/lib/ui";
import {
  RANGE_PRESETS,
  trDayKey,
  type DashboardRange,
} from "@/lib/dashboard-range";

/**
 * Tarih aralığı seçici.
 *
 * Sunucu yanıtı 47 sorgu sürdüğü için tıklama ile içeriğin değişmesi arasında
 * fark edilir bir boşluk oluşuyor. `useTransition` bu boşluğu ilk karede
 * doldurur: tıklanan düğme anında bekleme durumuna geçer. Özel aralık formu
 * JavaScript kapalıyken de düz bir GET formu olarak çalışmaya devam eder.
 */
export function RangePicker({ range }: { range: DashboardRange }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Sunucu yanıtı gelene kadar `range` eski aralığı gösterir; seçili görünümü
  // tıklanan düğmeye taşımak için hedefi ayrıca tutuyoruz.
  const [hedef, setHedef] = useState<string | null>(null);

  function goto(id: string, url: string) {
    setHedef(id);
    startTransition(() => router.push(url));
  }

  const bekleyen = pending ? hedef : null;
  const seciliId = bekleyen ?? range.preset;
  const bugun = trDayKey(new Date());

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => {
          const secili = seciliId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-current={secili ? "true" : undefined}
              onClick={() => goto(p.id, `/?aralik=${p.id}`)}
              className={
                secili
                  ? buttonCls("primary", "sm")
                  : buttonCls("secondary", "sm")
              }
            >
              {bekleyen === p.id && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      <form
        method="get"
        action="/"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const bas = String(fd.get("bas") ?? "");
          const bit = String(fd.get("bit") ?? "");
          goto(
            "ozel",
            `/?aralik=ozel&bas=${encodeURIComponent(bas)}&bit=${encodeURIComponent(bit)}`,
          );
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="aralik" value="ozel" />
        <div>
          <label
            htmlFor="range-bas"
            className="block text-[0.7rem] font-medium text-kb-muted"
          >
            Başlangıç
          </label>
          <input
            id="range-bas"
            type="date"
            name="bas"
            defaultValue={trDayKey(range.bas)}
            max={bugun}
            className="mt-1 rounded-md border border-kb-border bg-white px-2.5 py-1.5 text-sm text-kb-ink focus:border-kb-navy focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
          />
        </div>
        <div>
          <label
            htmlFor="range-bit"
            className="block text-[0.7rem] font-medium text-kb-muted"
          >
            Bitiş
          </label>
          <input
            id="range-bit"
            type="date"
            name="bit"
            defaultValue={trDayKey(range.bit)}
            max={bugun}
            className="mt-1 rounded-md border border-kb-border bg-white px-2.5 py-1.5 text-sm text-kb-ink focus:border-kb-navy focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
          />
        </div>
        <button
          type="submit"
          className={buttonCls(
            seciliId === "ozel" ? "primary" : "secondary",
            "sm",
          )}
        >
          {bekleyen === "ozel" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Uygula
        </button>
      </form>
    </div>
  );
}
