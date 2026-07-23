"use client";

import { useEffect, useState, useTransition } from "react";
import {
  dispatchAdaylariGetir,
  dispatchAracAtaAction,
} from "@/lib/actions/dispatch";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export interface AdayKart {
  vehicleId: string;
  plaka: string;
  tip: string | null;
  sureDk: number;
  mesafeKm: number;
  tahmini: boolean;
  skor: number;
  kirilim: {
    sure: number;
    tip: number;
    tazelik: number;
    yuk: number;
    yakit: number;
  };
  etiketler: string[];
}

/** Rota seçilince / kaydedilince yan panelde skorlu araç adayları */
export default function SmartAssignPanel({
  tip,
  routeId,
  routeAd,
  canEdit,
}: {
  tip: "KIS" | "COP";
  routeId: string | null;
  routeAd?: string | null;
  canEdit: boolean;
}) {
  const [adaylar, setAdaylar] = useState<AdayKart[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!routeId || !canEdit) {
      setAdaylar([]);
      setHata(null);
      return;
    }
    let iptal = false;
    setYukleniyor(true);
    setHata(null);
    dispatchAdaylariGetir(tip, routeId)
      .then((res) => {
        if (!iptal) setAdaylar(res.adaylar);
      })
      .catch((e) => {
        if (!iptal) {
          setAdaylar([]);
          setHata(e instanceof Error ? e.message : "Adaylar yüklenemedi");
        }
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [tip, routeId, canEdit]);

  function ata(vehicleId: string) {
    if (!routeId) return;
    startTransition(async () => {
      try {
        const { gorevNo } = await dispatchAracAtaAction(tip, routeId, vehicleId);
        window.alert(`Atandı: ${gorevNo}`);
        // Listeyi yenile (araç artık MUSAIT değil)
        const res = await dispatchAdaylariGetir(tip, routeId);
        setAdaylar(res.adaylar);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Atama başarısız");
      }
    });
  }

  function yenile() {
    if (!routeId) return;
    setYukleniyor(true);
    dispatchAdaylariGetir(tip, routeId)
      .then((res) => setAdaylar(res.adaylar))
      .catch((e) => setHata(e instanceof Error ? e.message : "Yenilenemedi"))
      .finally(() => setYukleniyor(false));
  }

  if (!canEdit) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
          Akıllı atama
        </p>
        {routeId && (
          <button
            type="button"
            onClick={yenile}
            disabled={yukleniyor || pending}
            className={`${btnSecondary} px-2 py-1 text-xs`}
          >
            Yenile
          </button>
        )}
      </div>

      {!routeId && (
        <p className="text-xs text-kb-muted">
          Haritadan veya listeden rota seçin / çizip kaydedin — uygun araçlar
          burada skorlanır.
        </p>
      )}

      {routeId && (
        <>
          {routeAd && (
            <p className="mb-2 text-sm font-medium text-kb-navy">{routeAd}</p>
          )}
          {yukleniyor && (
            <p className="text-xs text-kb-muted">Adaylar hesaplanıyor…</p>
          )}
          {hata && <p className="text-xs text-red-600">{hata}</p>}
          {!yukleniyor && !hata && adaylar.length === 0 && (
            <p className="text-xs text-kb-muted">
              Müsait ve konumlu araç bulunamadı. Şoförlerin konum paylaşımını
              kontrol edin.
            </p>
          )}
          <ul className="space-y-2">
            {adaylar.map((a, i) => (
              <li
                key={a.vehicleId}
                className={
                  i === 0
                    ? "rounded-md border-2 border-emerald-500 bg-white px-3 py-2"
                    : "rounded-md border border-kb-border bg-white px-3 py-2"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-kb-navy">{a.plaka}</span>
                      {a.tip && (
                        <span className="text-xs text-kb-muted">{a.tip}</span>
                      )}
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">
                        {a.skor}
                      </span>
                      {i === 0 && (
                        <span className="text-xs font-semibold text-emerald-700">
                          en uygun
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-kb-muted">
                      ~{a.sureDk} dk · {a.mesafeKm} km
                      {a.tahmini ? " (kuş uçuşu)" : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-kb-muted">
                      süre {a.kirilim.sure} · tip {a.kirilim.tip} · konum{" "}
                      {a.kirilim.tazelik} · yük {a.kirilim.yuk} · yakıt{" "}
                      {a.kirilim.yakit}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.etiketler.map((e) => (
                        <span
                          key={e}
                          className="rounded bg-kb-surface px-1.5 py-0.5 text-[10px] text-kb-ink"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => ata(a.vehicleId)}
                    disabled={pending}
                    className={`${btnPrimary} shrink-0 px-3 py-1.5 text-xs disabled:opacity-50`}
                  >
                    Ata
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
