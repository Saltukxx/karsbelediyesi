"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { Expand, Shrink } from "lucide-react";
import { dispatchAtaAction, dispatchReddetAction } from "@/lib/actions/dispatch";
import { btnSecondary, cardCls, sectionTitleCls } from "@/lib/ui";
import { StatCard } from "@/components/ui/StatCard";
import type { KomutaVeri } from "@/lib/komuta";
import { tipKisaLabel, type KomutaOdak } from "@/components/komuta/komuta-types";

const KomutaMap = dynamic(() => import("@/components/komuta/KomutaMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

const YENILEME_MS = 30_000;

export default function KomutaClient({ ilkVeri }: { ilkVeri: KomutaVeri }) {
  const [veri, setVeri] = useState<KomutaVeri>(ilkVeri);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<KomutaOdak | null>(null);
  const [tv, setTv] = useState(false);
  const [pending, startTransition] = useTransition();
  const kokRef = useRef<HTMLDivElement>(null);

  const yenile = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/komuta", { cache: "no-store" });
      if (!res.ok) throw new Error(`Sunucu ${res.status} döndü`);
      setVeri((await res.json()) as KomutaVeri);
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Veri alınamadı");
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(yenile, YENILEME_MS);
    return () => window.clearInterval(id);
  }, [yenile]);

  // Fullscreen'den Esc ile çıkınca TV modunu da kapat
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) setTv(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function tvDegistir() {
    if (!tv) {
      kokRef.current?.requestFullscreen?.().catch(() => undefined);
      setTv(true);
    } else {
      if (document.fullscreenElement) void document.exitFullscreen();
      setTv(false);
    }
  }

  function ata(jobId: string, tip: "KIS" | "COP" | "TEMIZLIK") {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("tip", tip);
    startTransition(async () => {
      try {
        await dispatchAtaAction(fd);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Atama başarısız");
      }
      await yenile();
    });
  }

  function reddet(jobId: string, tip: "KIS" | "COP" | "TEMIZLIK") {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("tip", tip);
    startTransition(async () => {
      try {
        await dispatchReddetAction(fd);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "İşlem başarısız");
      }
      await yenile();
    });
  }

  const { kpi } = veri;
  const gorevdeArac = veri.araclar.filter((a) => a.aktifGorev).length;
  const konumsuzArac = veri.araclar.filter((a) => a.lat == null).length;
  const gecikenSikayetler = veri.sikayetler.filter((s) => s.bucket !== "lt24");

  return (
    <div
      ref={kokRef}
      className={`flex flex-col gap-3 bg-kb-surface ${
        tv ? "h-screen overflow-auto p-4 text-[1.05rem]" : "h-full"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className={`font-semibold text-kb-navy ${tv ? "text-2xl" : "text-lg"}`}>
            Komuta Ekranı
          </h1>
          <p className="text-xs text-kb-muted">
            Canlı operasyon görünümü · son güncelleme{" "}
            {format(new Date(veri.zaman), "HH:mm:ss")}
            {hata && <span className="ml-2 text-kb-danger">({hata})</span>}
          </p>
        </div>
        <button type="button" onClick={tvDegistir} className={btnSecondary}>
          {tv ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          {tv ? "TV modundan çık" : "TV modu"}
        </button>
      </div>

      <div className={`grid gap-3 ${tv ? "grid-cols-6" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"}`}>
        <StatCard
          label="Açık şikayet"
          value={kpi.acikSikayet}
          hint={`${kpi.slaGt3} tanesi 3 günden eski`}
          tone={kpi.slaGt3 > 0 ? "danger" : "navy"}
        />
        <StatCard
          label="Bekleyen atama"
          value={kpi.bekleyenAtama}
          hint="dispatch önerisi"
          tone={kpi.bekleyenAtama > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Geciken rota"
          value={kpi.gecikenRota}
          hint="kış + çöp"
          tone={kpi.gecikenRota > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Devam eden görev"
          value={kpi.devamEdenGorev}
          hint="sahada"
          tone="navy"
        />
        <StatCard
          label="Canlı araç"
          value={`${kpi.tazeKonumluArac} / ${kpi.toplamArac}`}
          hint="15 dk içinde konum"
          tone={kpi.tazeKonumluArac > 0 ? "success" : "default"}
        />
        <StatCard
          label="Bugünkü operasyon"
          value={kpi.bugunOperasyon}
          hint="kış + çöp geçişi"
          tone="navy"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_360px]">
        <div className={`${tv ? "h-[calc(100vh-260px)]" : "h-[calc(100vh-320px)]"} min-h-[420px]`}>
          <KomutaMap
            araclar={veri.araclar}
            sikayetler={veri.sikayetler}
            gecikenRotalar={veri.gecikenRotalar}
            odak={odak}
          />
        </div>

        <div className="flex max-h-[calc(100vh-260px)] min-h-0 flex-col gap-3 overflow-auto">
          <section className={`${cardCls} p-3`}>
            <p className={`${sectionTitleCls} mb-2`}>
              Geciken işler ({veri.gecikenRotalar.length + gecikenSikayetler.length})
            </p>
            {veri.gecikenRotalar.length === 0 && gecikenSikayetler.length === 0 ? (
              <p className="text-sm text-kb-muted">Geciken iş yok.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {veri.gecikenRotalar.map((r) => (
                  <li key={`${r.tip}:${r.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setOdak({ tur: "rota", koordinatlar: r.koordinatlar, nonce: Date.now() })
                      }
                      className="w-full rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-left hover:bg-red-100"
                    >
                      <span className="font-semibold text-red-800">
                        {tipKisaLabel(r.tip)} · {r.ad}
                      </span>
                      <span className="block text-xs text-red-700">
                        {r.tip === "KIS"
                          ? `Öncelik-${r.oncelik} — ${r.esikSaat} saattir işlem yok`
                          : "Bugün toplanmalıydı"}
                        {r.sonIslem &&
                          ` · son işlem ${format(new Date(r.sonIslem), "dd.MM HH:mm")}`}
                      </span>
                    </button>
                  </li>
                ))}
                {gecikenSikayetler.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOdak({ tur: "nokta", lat: s.lat, lng: s.lng, nonce: Date.now() })
                      }
                      className={`w-full rounded-md border px-2.5 py-1.5 text-left ${
                        s.bucket === "gt3"
                          ? "border-red-200 bg-red-50 hover:bg-red-100"
                          : "border-orange-200 bg-orange-50 hover:bg-orange-100"
                      }`}
                    >
                      <span className="font-semibold text-kb-ink">{s.sikayetNo}</span>
                      <span className="block text-xs text-kb-muted">
                        {s.bucket === "gt3" ? "3 günden eski" : "1–3 gün"} · kayıt{" "}
                        {format(new Date(s.kayitTarihi), "dd.MM HH:mm")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${cardCls} p-3`}>
            <p className={`${sectionTitleCls} mb-2`}>
              Bekleyen atamalar ({veri.bekleyenler.length})
            </p>
            {veri.bekleyenler.length === 0 ? (
              <p className="text-sm text-kb-muted">Bekleyen dispatch önerisi yok.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {veri.bekleyenler.map((o) => (
                  <li
                    key={o.jobId}
                    className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
                  >
                    <span className="font-semibold text-kb-navy">
                      {tipKisaLabel(o.tip)} · {o.routeAd}
                    </span>
                    <span className="block text-xs text-kb-muted">
                      Önerilen: {o.plaka ?? "—"}
                      {o.aracTip && ` (${o.aracTip})`}
                      {o.sureDk != null && ` · ~${Math.round(o.sureDk)} dk`}
                      {o.tahmini && " (kuş uçuşu)"}
                    </span>
                    {o.gerekceOzet && (
                      <span className="block text-xs text-emerald-800">{o.gerekceOzet}</span>
                    )}
                    <span className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => ata(o.jobId, o.tip)}
                        disabled={pending}
                        className="inline-flex items-center rounded-md bg-kb-navy px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Ata
                      </button>
                      <button
                        type="button"
                        onClick={() => reddet(o.jobId, o.tip)}
                        disabled={pending}
                        className={`${btnSecondary} px-2.5 py-1 text-xs`}
                      >
                        Reddet
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${cardCls} p-3`}>
            <p className={`${sectionTitleCls} mb-2`}>Filo durumu</p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-kb-surface px-2 py-2">
                <div className="text-lg font-semibold text-kb-navy tabular-nums">
                  {gorevdeArac}
                </div>
                <div className="text-xs text-kb-muted">görevde</div>
              </div>
              <div className="rounded-md bg-kb-surface px-2 py-2">
                <div className="text-lg font-semibold text-emerald-700 tabular-nums">
                  {veri.araclar.length - gorevdeArac - konumsuzArac}
                </div>
                <div className="text-xs text-kb-muted">boşta</div>
              </div>
              <div className="rounded-md bg-kb-surface px-2 py-2">
                <div className="text-lg font-semibold text-kb-muted tabular-nums">
                  {konumsuzArac}
                </div>
                <div className="text-xs text-kb-muted">konumsuz</div>
              </div>
            </div>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
              {veri.araclar
                .filter((a) => a.lat != null)
                .map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOdak({
                          tur: "nokta",
                          lat: a.lat as number,
                          lng: a.lng as number,
                          nonce: Date.now(),
                        })
                      }
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-kb-surface"
                    >
                      <span>
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                            a.taze ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        />
                        <span className="font-medium text-kb-ink">{a.plaka}</span>
                        {a.tip && <span className="text-kb-muted"> · {a.tip}</span>}
                      </span>
                      <span className="text-kb-muted">
                        {a.rotada != null && (
                          <span
                            className={`mr-1.5 rounded px-1 py-0.5 text-[10px] font-semibold ${
                              a.rotada
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {a.rotada ? "rotada" : `rota dışı (${a.rotaUzaklikM} m)`}
                          </span>
                        )}
                        {a.aktifGorev ? a.aktifGorev.gorevNo : "boşta"}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            <Link
              href="/araclar"
              className="mt-2 block text-xs font-medium text-kb-navy hover:underline"
            >
              Araç envanterine git →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
