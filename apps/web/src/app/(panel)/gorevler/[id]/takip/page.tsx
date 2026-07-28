import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@kars/db";
import { PageHeader } from "@/components/ui/PageHeader";
import TrackReportPanel from "@/components/map/TrackReportPanel";
import { assertTaskPageAccess } from "@/lib/access";
import { requirePageAccess } from "@/lib/authz";
import { gorevYenidenAnalizEt } from "@/lib/actions/track";
import { tipLabel } from "@/lib/dispatch";
import { btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import type {
  DuraklamaDto,
  SapmaDto,
  TrackReportData,
  VeriBosluguDto,
} from "@/components/map/track-report-types";

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

function dk(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 60) return `${Math.floor(v / 60)} sa ${Math.round(v % 60)} dk`;
  return `${Math.round(v * 10) / 10} dk`;
}

function zaman(d: Date | null | undefined): string {
  return d ? format(d, "dd.MM.yyyy HH:mm") : "—";
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
  const gorev = await assertTaskPageAccess(session, id);

  const [analiz, detay] = await Promise.all([
    prisma.routeTrackAnalysis.findUnique({ where: { taskId: id } }),
    prisma.vehicleTask.findUnique({
      where: { id },
      select: {
        gorevNo: true,
        gorevTanimi: true,
        cikisTarihi: true,
        girisTarihi: true,
        dispatchJobId: true,
        vehicle: { select: { plaka: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  const sapmalar = ((analiz?.sapmalar as unknown as SapmaDto[]) ?? []).filter(Boolean);
  const duraklamalar = (
    (analiz?.duraklamalar as unknown as DuraklamaDto[]) ?? []
  ).filter(Boolean);
  const bosluklar = (
    (analiz?.veriBosluklari as unknown as VeriBosluguDto[]) ?? []
  ).filter(Boolean);

  // Kronolojik zaman çizelgesi
  type Olay = { ms: number; etiket: string; detay: string; ton: string };
  const olaylar: Olay[] = [];
  if (analiz?.rotaGiris) {
    olaylar.push({
      ms: analiz.rotaGiris.getTime(),
      etiket: "Rotaya giriş",
      detay: zaman(analiz.rotaGiris),
      ton: "text-emerald-700",
    });
  }
  for (const s of sapmalar) {
    olaylar.push({
      ms: s.baslangicMs,
      etiket: "Rota dışı sapma",
      detay: `${format(new Date(s.baslangicMs), "HH:mm")} → ${format(new Date(s.bitisMs), "HH:mm")} · ${s.sureDk} dk · en fazla ${s.maxMesafeM} m`,
      ton: "text-orange-700",
    });
  }
  for (const d of duraklamalar) {
    olaylar.push({
      ms: d.baslangicMs,
      etiket: d.rotaUzerinde ? "Duraklama (rotada)" : "Duraklama (rota dışı)",
      detay: `${format(new Date(d.baslangicMs), "HH:mm")} → ${format(new Date(d.bitisMs), "HH:mm")} · ${d.sureDk} dk`,
      ton: d.rotaUzerinde ? "text-teal-700" : "text-red-700",
    });
  }
  for (const b of bosluklar) {
    olaylar.push({
      ms: b.baslangicMs,
      etiket: "Veri boşluğu",
      detay: `${format(new Date(b.baslangicMs), "HH:mm")} → ${format(new Date(b.bitisMs), "HH:mm")} · ${b.sureDk} dk ping yok`,
      ton: "text-purple-700",
    });
  }
  if (analiz?.rotaCikis) {
    olaylar.push({
      ms: analiz.rotaCikis.getTime(),
      etiket: "Rotadan çıkış",
      detay: zaman(analiz.rotaCikis),
      ton: "text-red-700",
    });
  }
  olaylar.sort((a, b) => a.ms - b.ms);

  const toplamSapmaDk = sapmalar.reduce((s, x) => s + x.sureDk, 0);
  const toplamDuraklamaDk = duraklamalar.reduce((s, x) => s + x.sureDk, 0);

  const mapData: TrackReportData | null = analiz
    ? {
        planlanan: [],
        eksikSegmentler:
          ((analiz.eksikSegmentler as unknown as [number, number][][]) ?? []) || [],
        iz:
          ((analiz.izKoordinatlar as unknown as [
            number,
            number,
            number,
            number | null,
          ][]) ?? []) || [],
        sapmalar,
        duraklamalar,
        veriBosluklari: bosluklar,
        rotaGirisMs: analiz.rotaGiris?.getTime() ?? null,
        rotaCikisMs: analiz.rotaCikis?.getTime() ?? null,
      }
    : null;

  // Planlanan rota polyline'ı güncel halinden yüklenir
  if (analiz && mapData) {
    let koordinatlar: unknown = null;
    switch (analiz.tip) {
      case "KIS":
        koordinatlar = (
          await prisma.winterRoute.findUnique({
            where: { id: analiz.routeId },
            select: { koordinatlar: true },
          })
        )?.koordinatlar;
        break;
      case "COP":
        koordinatlar = (
          await prisma.wasteRoute.findUnique({
            where: { id: analiz.routeId },
            select: { koordinatlar: true },
          })
        )?.koordinatlar;
        break;
      case "TEMIZLIK":
        koordinatlar = (
          await prisma.cleaningRoute.findUnique({
            where: { id: analiz.routeId },
            select: { koordinatlar: true },
          })
        )?.koordinatlar;
        break;
      default: {
        const _exhaustive: never = analiz.tip;
        koordinatlar = _exhaustive;
      }
    }
    if (Array.isArray(koordinatlar)) {
      mapData.planlanan = koordinatlar as [number, number][];
    }
  }

  const sonucBadge = analiz ? SONUC_LABEL[analiz.sonuc] : null;
  const kaliteBadge = analiz ? KALITE_LABEL[analiz.veriKalitesi] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={`Takip Raporu — ${detay?.gorevNo ?? gorev.gorevNo}`}
          description={
            analiz
              ? `${tipLabel(analiz.tip)} · ${analiz.routeAd} · ${detay?.vehicle?.plaka ?? ""}${detay?.driver?.name ? ` · ${detay.driver.name}` : ""}`
              : (detay?.gorevTanimi ?? "GPS izi ↔ planlanan rota karşılaştırması")
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

      {!detay?.dispatchJobId ? (
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
              Son analiz: {zaman(analiz.updatedAt)}
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
                  alt={`${sapmalar.length} sapma olayı · rota dışı ${dk(toplamSapmaDk)}`}
                />
                <Kpi
                  baslik="Duraklama"
                  deger={`${duraklamalar.length} kez`}
                  alt={`toplam ${dk(toplamDuraklamaDk)}`}
                />
                <Kpi
                  baslik="Ping"
                  deger={`${analiz.pingSayisi}`}
                  alt={`ortalama aralık ${analiz.ortPingAraligiSn != null ? `${analiz.ortPingAraligiSn} sn` : "—"} · ${bosluklar.length} veri boşluğu`}
                />
              </div>

              {mapData && <TrackReportPanel data={mapData} />}

              <div className={`${cardCls} p-4`}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
                  Zaman çizelgesi
                </p>
                {olaylar.length === 0 ? (
                  <p className="text-sm text-kb-muted">
                    Kayda değer olay yok (sapma/duraklama/boşluk tespit edilmedi).
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {olaylar.map((o, i) => (
                      <li key={i} className="flex items-baseline gap-3 text-sm">
                        <span className="w-14 shrink-0 font-mono text-xs text-kb-muted">
                          {format(new Date(o.ms), "HH:mm")}
                        </span>
                        <span className={`font-medium ${o.ton}`}>{o.etiket}</span>
                        <span className="text-xs text-kb-muted">{o.detay}</span>
                      </li>
                    ))}
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
