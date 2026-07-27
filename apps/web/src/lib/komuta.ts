import { prisma } from "@kars/db";
import { KONUM_TAZELIK_MS } from "@/lib/location";
import { gerekceOzeti, type DispatchGerekce } from "@/lib/dispatch";
import { gecikenCopRotalari, gecikenKisRotalari } from "@/lib/sla-notify";

export type KomutaSlaBucket = "lt24" | "d1to3" | "gt3";

export interface KomutaAracDto {
  id: string;
  plaka: string;
  tip: string | null;
  lat: number | null;
  lng: number | null;
  /** ISO — son konum zamanı (konum yoksa null) */
  konumZamani: string | null;
  /** Konum 15 dk'dan taze mi */
  taze: boolean;
  /** Devam eden görev (yoksa null) */
  aktifGorev: { gorevNo: string; tanim: string | null } | null;
}

export interface KomutaSikayetPinDto {
  id: string;
  sikayetNo: string;
  oncelik: string;
  aciklama: string | null;
  lat: number;
  lng: number;
  /** ISO kayıt tarihi */
  kayitTarihi: string;
  bucket: KomutaSlaBucket;
}

export interface KomutaGecikenRotaDto {
  id: string;
  tip: "KIS" | "COP";
  ad: string;
  /** Kış: rota önceliği; çöp: null */
  oncelik: number | null;
  /** Kış: 12/18 saat eşiği; çöp: null (bugün toplanmalıydı) */
  esikSaat: number | null;
  /** ISO — son operasyon/toplama (hiç yoksa null) */
  sonIslem: string | null;
  koordinatlar: [number, number][];
}

export interface KomutaBekleyenDto {
  jobId: string;
  tip: "KIS" | "COP";
  routeAd: string;
  plaka: string | null;
  aracTip: string | null;
  mesafeKm: number | null;
  sureDk: number | null;
  tahmini: boolean;
  gerekceOzet: string | null;
  /** ISO */
  createdAt: string;
}

export interface KomutaKpiDto {
  /** Açık + devam eden şikayet */
  acikSikayet: number;
  slaLt24: number;
  sla1to3: number;
  slaGt3: number;
  bekleyenAtama: number;
  gecikenRota: number;
  devamEdenGorev: number;
  tazeKonumluArac: number;
  toplamArac: number;
  /** Bugün tamamlanan kış operasyonu + çöp toplaması */
  bugunOperasyon: number;
}

export interface KomutaVeri {
  /** ISO — verinin üretildiği an */
  zaman: string;
  kpi: KomutaKpiDto;
  araclar: KomutaAracDto[];
  sikayetler: KomutaSikayetPinDto[];
  bekleyenler: KomutaBekleyenDto[];
  gecikenRotalar: KomutaGecikenRotaDto[];
}

function slaBucket(kayitTarihi: Date, now: number): KomutaSlaBucket {
  const yasMs = now - kayitTarihi.getTime();
  if (yasMs < 24 * 60 * 60 * 1000) return "lt24";
  if (yasMs < 3 * 24 * 60 * 60 * 1000) return "d1to3";
  return "gt3";
}

/**
 * Komuta ekranının tek toplama noktası: canlı araçlar, açık şikayetler,
 * bekleyen dispatch önerileri, geciken rotalar ve günlük KPI'lar.
 * Salt okunur — bildirim/atama tetiklemez.
 */
export async function komutaVerisiGetir(): Promise<KomutaVeri> {
  const now = Date.now();
  const bugunBasi = new Date(now);
  bugunBasi.setHours(0, 0, 0, 0);

  const [
    araclar,
    sikayetler,
    bekleyenJoblar,
    gecikenKis,
    gecikenCop,
    devamEdenGorev,
    bugunKis,
    bugunCop,
  ] = await Promise.all([
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      orderBy: { plaka: "asc" },
      select: {
        id: true,
        plaka: true,
        sonKonumLat: true,
        sonKonumLng: true,
        sonKonumZamani: true,
        vehicleType: { select: { name: true } },
        tasks: {
          where: { durum: "DEVAM_EDIYOR" },
          orderBy: { cikisTarihi: "desc" },
          take: 1,
          select: { gorevNo: true, gorevTanimi: true, gorevYeri: true },
        },
      },
    }),
    prisma.complaint.findMany({
      where: { durum: { in: ["ACIK", "DEVAM_EDIYOR"] } },
      select: {
        id: true,
        sikayetNo: true,
        oncelik: true,
        aciklama: true,
        lat: true,
        lng: true,
        kayitTarihi: true,
      },
    }),
    prisma.dispatchJob.findMany({
      where: { durum: "ONERILDI" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        vehicle: {
          select: { plaka: true, vehicleType: { select: { name: true } } },
        },
      },
    }),
    gecikenKisRotalari(now),
    gecikenCopRotalari(now),
    prisma.vehicleTask.count({ where: { durum: "DEVAM_EDIYOR" } }),
    prisma.winterOperation.count({ where: { baslangic: { gte: bugunBasi } } }),
    prisma.wasteCollection.count({ where: { baslangic: { gte: bugunBasi } } }),
  ]);

  const aracDtos: KomutaAracDto[] = araclar.map((v) => ({
    id: v.id,
    plaka: v.plaka,
    tip: v.vehicleType?.name ?? null,
    lat: v.sonKonumLat,
    lng: v.sonKonumLng,
    konumZamani: v.sonKonumZamani?.toISOString() ?? null,
    taze:
      !!v.sonKonumZamani && now - v.sonKonumZamani.getTime() <= KONUM_TAZELIK_MS,
    aktifGorev: v.tasks[0]
      ? {
          gorevNo: v.tasks[0].gorevNo,
          tanim: v.tasks[0].gorevTanimi ?? v.tasks[0].gorevYeri ?? null,
        }
      : null,
  }));

  const sikayetPinleri: KomutaSikayetPinDto[] = sikayetler
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      id: s.id,
      sikayetNo: s.sikayetNo,
      oncelik: s.oncelik,
      aciklama: s.aciklama,
      lat: s.lat as number,
      lng: s.lng as number,
      kayitTarihi: s.kayitTarihi.toISOString(),
      bucket: slaBucket(s.kayitTarihi, now),
    }));

  let slaLt24 = 0;
  let sla1to3 = 0;
  let slaGt3 = 0;
  for (const s of sikayetler) {
    const b = slaBucket(s.kayitTarihi, now);
    if (b === "lt24") slaLt24 += 1;
    else if (b === "d1to3") sla1to3 += 1;
    else slaGt3 += 1;
  }

  const bekleyenler: KomutaBekleyenDto[] = bekleyenJoblar.map((j) => ({
    jobId: j.id,
    tip: j.tip,
    routeAd: j.routeAd,
    plaka: j.vehicle?.plaka ?? null,
    aracTip: j.vehicle?.vehicleType?.name ?? null,
    mesafeKm: j.mesafeKm,
    sureDk: j.sureDk,
    tahmini: j.tahmini,
    gerekceOzet: gerekceOzeti(j.gerekce as DispatchGerekce | null),
    createdAt: j.createdAt.toISOString(),
  }));

  const gecikenRotalar: KomutaGecikenRotaDto[] = [
    ...gecikenKis.map((r) => ({
      id: r.id,
      tip: "KIS" as const,
      ad: r.ad,
      oncelik: r.oncelik,
      esikSaat: r.esikSaat,
      sonIslem: r.sonIslem?.toISOString() ?? null,
      koordinatlar: r.koordinatlar,
    })),
    ...gecikenCop.map((r) => ({
      id: r.id,
      tip: "COP" as const,
      ad: r.ad,
      oncelik: null,
      esikSaat: null,
      sonIslem: r.sonIslem?.toISOString() ?? null,
      koordinatlar: r.koordinatlar,
    })),
  ];

  return {
    zaman: new Date(now).toISOString(),
    kpi: {
      acikSikayet: sikayetler.length,
      slaLt24,
      sla1to3,
      slaGt3,
      bekleyenAtama: bekleyenler.length,
      gecikenRota: gecikenRotalar.length,
      devamEdenGorev,
      tazeKonumluArac: aracDtos.filter((a) => a.taze).length,
      toplamArac: aracDtos.length,
      bugunOperasyon: bugunKis + bugunCop,
    },
    araclar: aracDtos,
    sikayetler: sikayetPinleri,
    bekleyenler,
    gecikenRotalar,
  };
}
