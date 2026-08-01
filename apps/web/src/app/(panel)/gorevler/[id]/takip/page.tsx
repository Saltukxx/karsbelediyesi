import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import TrackReportPanel from "@/components/map/TrackReportPanel";
import { assertTaskPageAccess } from "@/lib/access";
import { requirePageAccess } from "@/lib/authz";
import { gorevYenidenAnalizEt } from "@/lib/actions/track";
import { tipLabel } from "@/lib/dispatch";
import { gorevTakipRaporu } from "@/lib/services/tasks";
import { btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import type { TakipOlayTipi, TrackReportData } from "@/lib/api/track-dto";

export const dynamic = "force-dynamic";

const SONUC_LABEL: Record<string, { label: string; cls: string }> = {
  TAMAMLANDI: { label: "Tamamlandı", cls: "bg-emerald-100 text-emerald-800" },
  KISMEN: { label: "Kısmen tamamlandı", cls: "bg-amber-100 text-amber-800" },
  YETERSIZ: { label: "Yetersiz", cls: "bg-red-100 text-red-800" },
  VERI_YOK: { label: "Veri yok", cls: "bg-gray-200 text-gray-700" },
};

const KALITE_LABEL: Record<string, { label: string; cls: string }> = {
  IYI: { label: "Veri kalitesi: İyi", cls: "bg-emerald-50 text-emerald-700" },
  ZAYIF: { label: "Veri kalitesi: Zayıf", cls: "bg-amber-50 text-amber-700" },
  YOK: { label: "Veri yok", cls: "bg-gray-100 text-gray-600" },
};

const OLAY_LABEL: Record<TakipOlayTipi, { etiket: string; ton: string }> = {
  ROTA_GIRIS: { etiket: "Rotaya giriş", ton: "text-emerald-700" },
  SAPMA: { etiket: "Rota dışı sapma", ton: "text-orange-700" },
  DURAKLAMA_ROTADA: { etiket: "Duraklama (rotada)", ton: "text-teal-700" },
  DURAKLAMA_ROTA_DISI: { etiket: "Duraklama (rota dışı)", ton: "text-red-700" },
  VERI_BOSLUGU: { etiket: "Veri boşluğu", ton: "text-purple-700" },
  ROTA_CIKIS: { etiket: "Rotadan çıkış", ton: "text-red-700" },
};

function dk(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 60) return `${Math.floor(v / 60)} sa ${Math.round(v % 60)} dk`;
  return `${Math.round(v * 10) / 10} dk`;
}

function saat(ms: number | null): string {
  return ms == null ? "—" : format(new Date(ms), "HH:mm");
}

function zaman(iso: string | null): string {
  return iso ? format(new Date(iso), "dd.MM.yyyy HH:mm") : "—";
}

function Kpi({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className={`${cardCls} p-4`}>
      <div className="text-xs text-kb-muted">{baslik}</div>
      <div className="mt-1 text-xl font-semibold text-kb-navy">{deger}</div>
      {alt && <div className="mt-1 text-xs text-kb-muted">{alt}</div>}
    </div>
  );
}

export default async function GorevTakipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageAccess("/gorevler");
  const { id } = await params;
  // Sayfa yolunda erişim hatası 404'e düşer; servis 403/404 fırlatmadan önce
  // kontrol edilir (API tarafı aynı kuralı HTTP durumu olarak döner).
  await assertTaskPageAccess(session, id);
  const rapor = await gorevTakipRaporu(session, id);
  const analiz = rapor.analiz;

  const mapData: TrackReportData | null = rapor.harita
    ? {
        planlanan: rapor.harita.planlanan,
        eksikSegmentler: rapor.harita.eksikSegmentler,
        iz: rapor.harita.iz,
        sapmalar: rapor.sapmalar,
        duraklamalar: rapor.duraklamalar,
        veriBosluklari: rapor.veriBosluklari,
        rotaGirisMs: analiz?.rotaGiris ? new Date(analiz.rotaGiris).getTime() : null,
        rotaCikisMs: analiz?.rotaCikis ? new Date(analiz.rotaCikis).getTime() : null,
      }
    : null;

  const sonucBadge = analiz ? SONUC_LABEL[analiz.sonuc] : null;
  const kaliteBadge = analiz ? KALITE_LABEL[analiz.veriKalitesi] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={`Takip Raporu — ${rapor.gorevNo}`}
          description={
            analiz
              ? `${tipLabel(analiz.tip)} · ${analiz.routeAd} · ${rapor.plaka}${rapor.soforAdi ? ` · ${rapor.soforAdi}` : ""}`
              : (rapor.gorevTanimi ?? "GPS izi ↔ planlanan rota karşılaştırması")
          }
        />
        <div className="flex items-center gap-2">
          <Link href="/gorevler" className={btnSecondary}>
            ← Görevler
          </Link>
          <form action={gorevYenidenAnalizEt}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={btnPrimary}>
              Yeniden analiz et
            </button>
          </form>
        </div>
      </div>

      {!rapor.dispatchVar ? (
        <div className={`${cardCls} p-6 text-sm text-kb-muted`}>
          Bu görev bir dispatch rotasına bağlı değil; rota takip analizi yalnızca
          kış / çöp / yol temizliği rotalarına atanan görevler için üretilir.
        </div>
      ) : !analiz ? (
        <div className={`${cardCls} p-6`}>
          <p className="text-sm font-semibold text-kb-ink">Henüz analiz yok</p>
          <p className="mt-1 text-sm text-kb-muted">
            Analiz görev kapanışında otomatik üretilir. GPS verisi geldiyse
            &quot;Yeniden analiz et&quot; ile şimdi üretebilirsiniz.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {sonucBadge && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${sonucBadge.cls}`}
              >
                {sonucBadge.label}
              </span>
            )}
            {kaliteBadge && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${kaliteBadge.cls}`}
              >
                {kaliteBadge.label}
              </span>
            )}
            {analiz.notlar && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                {analiz.notlar}
              </span>
            )}
            <span className="text-xs text-kb-muted">
              Son analiz: {zaman(analiz.guncellemeTarihi)}
            </span>
          </div>

          {analiz.sonuc === "VERI_YOK" ? (
            <div className={`${cardCls} p-6 text-sm text-kb-muted`}>
              Görev süresi içinde bu araçtan GPS verisi bulunamadı. Veri
              geldiğinde &quot;Yeniden analiz et&quot; ile rapor üretilebilir.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  baslik="Rotada kalma uyumu"
                  deger={`%${analiz.uyumYuzde}`}
                  alt="buffer içindeki ping oranı"
                />
                <Kpi
                  baslik="Rota kapsaması"
                  deger={`%${analiz.kapsamaYuzde}`}
                  alt="rotanın kat edilen kısmı"
                />
                <Kpi
                  baslik="Rotaya giriş"
                  deger={zaman(analiz.rotaGiris)}
                  alt={`çıkış: ${zaman(analiz.rotaCikis)}`}
                />
                <Kpi
                  baslik="Rota üzerindeki süre"
                  deger={dk(analiz.sureDk)}
                  alt={`toplam mesafe: ${analiz.toplamMesafeKm ?? "—"} km`}
                />
                <Kpi
                  baslik="Ortalama / maks hız"
                  deger={`${analiz.ortalamaHizKmh ?? "—"} / ${analiz.maxHizKmh ?? "—"} km/sa`}
                />
                <Kpi
                  baslik="Ortalama / maks sapma"
                  deger={`${analiz.ortSapmaM ?? "—"} / ${analiz.maxSapmaM ?? "—"} m`}
                  alt={`${rapor.sapmalar.length} sapma olayı · rota dışı ${dk(rapor.toplamSapmaDk)}`}
                />
                <Kpi
                  baslik="Duraklama"
                  deger={`${rapor.duraklamalar.length} kez`}
                  alt={`toplam ${dk(rapor.toplamDuraklamaDk)}`}
                />
                <Kpi
                  baslik="Ping"
                  deger={`${analiz.pingSayisi}`}
                  alt={`ortalama aralık ${analiz.ortPingAraligiSn != null ? `${analiz.ortPingAraligiSn} sn` : "—"} · ${rapor.veriBosluklari.length} veri boşluğu`}
                />
              </div>

              {mapData && <TrackReportPanel data={mapData} />}

              <div className={`${cardCls} p-4`}>
                <p className="mb-2 text-[0.8rem] font-medium text-kb-muted">
                  Zaman çizelgesi
                </p>
                {rapor.zamanCizelgesi.length === 0 ? (
                  <p className="text-sm text-kb-muted">
                    Kayda değer olay yok (sapma/duraklama/boşluk tespit edilmedi).
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {rapor.zamanCizelgesi.map((o, i) => {
                      const sunum = OLAY_LABEL[o.tip];
                      const detay = [
                        o.bitisMs != null
                          ? `${saat(o.baslangicMs)} → ${saat(o.bitisMs)}`
                          : saat(o.baslangicMs),
                        o.sureDk != null ? `${o.sureDk} dk` : null,
                        o.maxMesafeM != null ? `en fazla ${o.maxMesafeM} m` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={i} className="flex items-baseline gap-3 text-sm">
                          <span className="w-14 shrink-0 font-mono text-xs text-kb-muted">
                            {saat(o.baslangicMs)}
                          </span>
                          <span className={`font-medium ${sunum.ton}`}>
                            {sunum.etiket}
                          </span>
                          <span className="text-xs text-kb-muted">{detay}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
