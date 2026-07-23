"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { dispatchAtaAction, dispatchReddetAction } from "@/lib/actions/dispatch";
import { btnSecondary } from "@/lib/ui";

export interface DispatchOneriDto {
  jobId: string;
  routeAd: string;
  plaka: string | null;
  aracTip: string | null;
  mesafeKm: number | null;
  sureDk: number | null;
  tahmini: boolean;
  /** Skor özeti: "skor 72 · tip uyumlu · taze konum" */
  gerekceOzet: string | null;
  /** ISO */
  createdAt: string;
}

/** Bekleyen dispatch önerileri — /kis ve /cop sayfalarının üstünde */
export default function DispatchPanel({
  tip,
  oneriler,
  canEdit,
}: {
  tip: "KIS" | "COP";
  oneriler: DispatchOneriDto[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (oneriler.length === 0) return null;

  function ata(jobId: string) {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("tip", tip);
    startTransition(async () => {
      try {
        await dispatchAtaAction(fd);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Atama başarısız");
      }
    });
  }

  function reddet(jobId: string) {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("tip", tip);
    startTransition(() => dispatchReddetAction(fd));
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
        Bekleyen görevler — dispatch önerileri ({oneriler.length})
      </p>
      <ul className="space-y-2">
        {oneriler.map((o) => (
          <li
            key={o.jobId}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-kb-navy">{o.routeAd}</span>
              {" — önerilen araç: "}
              <span className="font-semibold">{o.plaka ?? "—"}</span>
              {o.aracTip && <span className="text-kb-muted"> ({o.aracTip})</span>}
              {o.sureDk != null && (
                <span className="text-kb-muted">
                  {" "}
                  · tahmini varış {o.sureDk} dk / {o.mesafeKm} km
                  {o.tahmini ? " (kuş uçuşu)" : ""}
                </span>
              )}
              {o.gerekceOzet && (
                <span className="mt-0.5 block text-xs text-emerald-800">
                  {o.gerekceOzet}
                </span>
              )}
              <span className="ml-1 text-xs text-kb-muted">
                {format(new Date(o.createdAt), "dd.MM HH:mm")}
              </span>
            </span>
            {canEdit && (
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => ata(o.jobId)}
                  disabled={pending}
                  className="inline-flex items-center rounded-md bg-kb-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Ata
                </button>
                <button
                  type="button"
                  onClick={() => reddet(o.jobId)}
                  disabled={pending}
                  className={`${btnSecondary} px-3 py-1.5 text-xs`}
                >
                  Reddet
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
