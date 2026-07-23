import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import type { DispatchTip, Prisma } from "@kars/db";
import { KONUM_TAZELIK_MS, kusUcusuKm } from "@/lib/location";
import { yolRotasi, type YolRotasi } from "@/lib/routing";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

/**
 * Dispatch motoru: çok faktörlü skor (süre, tip, konum tazeliği, iş yükü, yakıt)
 * ile en uygun aracı seçer. UI top-5 listesi ve otomatik tarama aynı motoru kullanır.
 */

export const OTOMATIK_ATAMA_KEY = "dispatchOtomatikAtama";

const TIP_REGEX: Record<DispatchTip, RegExp> = {
  KIS: /kar|tuz|grey|k[üu]re|kep[çc]e|greyder|dozer/i,
  COP: /[çc][öo]p|s[ıi]k[ıi][şs]t[ıi]rma|hidrolik/i,
};

/** Ağırlıklar — toplam 1.0 */
const AGIRLIK = {
  sure: 0.4,
  tip: 0.2,
  tazelik: 0.1,
  yuk: 0.15,
  yakit: 0.15,
} as const;

const MAX_ADAY = 5;
/** Bu süreden eski yakıt kaydı hafif ceza alır */
const YAKIT_KAYIT_ESIK_MS = 30 * 24 * 60 * 60 * 1000;

export interface SkorKirilim {
  sure: number;
  tip: number;
  tazelik: number;
  yuk: number;
  yakit: number;
}

export interface DispatchAday {
  vehicleId: string;
  plaka: string;
  tip: string | null;
  sureDk: number;
  mesafeKm: number;
  tahmini: boolean;
  /** 0–100 */
  skor: number;
  kirilim: SkorKirilim;
  etiketler: string[];
  /** OSRM gidiş geometrisi — atamada DispatchJob'a yazılır */
  rota: [number, number][];
}

export interface DispatchGerekce {
  skor: number;
  kirilim: SkorKirilim;
  etiketler: string[];
}

export interface DispatchOneri {
  jobId: string;
  tip: DispatchTip;
  routeId: string;
  routeAd: string;
  vehicleId: string;
  plaka: string;
  aracTip: string | null;
  mesafeKm: number;
  sureDk: number;
  tahmini: boolean;
  gerekce: DispatchGerekce | null;
}

export async function otomatikAtamaAcikMi(): Promise<boolean> {
  const s = await prisma.appSetting.findUnique({ where: { key: OTOMATIK_ATAMA_KEY } });
  return s?.value === "true";
}

export async function otomatikAtamaAyarla(acik: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: OTOMATIK_ATAMA_KEY },
    update: { value: String(acik) },
    create: { key: OTOMATIK_ATAMA_KEY, value: String(acik) },
  });
}

async function rotaYukle(
  tip: DispatchTip,
  routeId: string,
): Promise<{ ad: string; baslangic: [number, number] } | null> {
  const route =
    tip === "KIS"
      ? await prisma.winterRoute.findUnique({
          where: { id: routeId },
          select: { ad: true, koordinatlar: true },
        })
      : await prisma.wasteRoute.findUnique({
          where: { id: routeId },
          select: { ad: true, koordinatlar: true },
        });
  if (!route) return null;
  const koordinatlar = route.koordinatlar as [number, number][];
  if (!Array.isArray(koordinatlar) || koordinatlar.length === 0) return null;
  return { ad: route.ad, baslangic: koordinatlar[0] };
}

function normalizeTers(deger: number, max: number): number {
  if (max <= 0) return 1;
  return Math.max(0, 1 - deger / max);
}

/**
 * Rota için skorlanmış araç adayları (en yüksek skor önce, max 5).
 * Konum yoksa aday olmaz; bayat konum listede kalır ama tazelik skoru düşer.
 */
export async function adaylariSkorla(
  tip: DispatchTip,
  routeId: string,
  opts: { excludeVehicleIds?: string[] } = {},
): Promise<{ routeAd: string; adaylar: DispatchAday[] }> {
  const rota = await rotaYukle(tip, routeId);
  if (!rota) return { routeAd: "", adaylar: [] };

  const exclude = new Set(opts.excludeVehicleIds ?? []);
  const [hedefLat, hedefLng] = rota.baslangic;
  const bugunBasi = new Date();
  bugunBasi.setHours(0, 0, 0, 0);
  const now = Date.now();

  const adaylar = await prisma.vehicle.findMany({
    where: {
      operasyonDurumu: "MUSAIT",
      envanterDurumu: "AKTIF",
      sonKonumLat: { not: null },
      sonKonumLng: { not: null },
      ...(exclude.size > 0 ? { id: { notIn: [...exclude] } } : {}),
    },
    select: {
      id: true,
      plaka: true,
      sonKonumLat: true,
      sonKonumLng: true,
      sonKonumZamani: true,
      normTuketim: true,
      vehicleType: { select: { name: true } },
    },
  });
  if (adaylar.length === 0) return { routeAd: rota.ad, adaylar: [] };

  // Haversine ile en yakın 8'e indir (OSRM maliyeti)
  const yakin = adaylar
    .map((a) => ({
      arac: a,
      kusUcusu: kusUcusuKm(
        a.sonKonumLat as number,
        a.sonKonumLng as number,
        hedefLat,
        hedefLng,
      ),
    }))
    .sort((x, y) => x.kusUcusu - y.kusUcusu)
    .slice(0, 8);

  const vehicleIds = yakin.map((y) => y.arac.id);

  const [rotali, bugunDispatch, aktifGorev, sonYakitlar, sonBirim] = await Promise.all([
    Promise.all(
      yakin.map(async ({ arac }) => ({
        arac,
        rota: await yolRotasi(
          arac.sonKonumLat as number,
          arac.sonKonumLng as number,
          hedefLat,
          hedefLng,
        ),
      })),
    ),
    prisma.dispatchJob.groupBy({
      by: ["vehicleId"],
      where: {
        vehicleId: { in: vehicleIds },
        durum: "ATANDI",
        createdAt: { gte: bugunBasi },
      },
      _count: { id: true },
    }),
    prisma.vehicleTask.groupBy({
      by: ["vehicleId"],
      where: {
        vehicleId: { in: vehicleIds },
        durum: "DEVAM_EDIYOR",
      },
      _count: { id: true },
    }),
    prisma.fuelRecord.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { tarih: "desc" },
      distinct: ["vehicleId"],
      select: { vehicleId: true, tarih: true },
    }),
    prisma.fuelRecord.findFirst({
      orderBy: { tarih: "desc" },
      select: { birimFiyat: true },
    }),
  ]);

  const yukByVehicle = new Map<string, number>();
  for (const d of bugunDispatch) {
    if (d.vehicleId) yukByVehicle.set(d.vehicleId, (yukByVehicle.get(d.vehicleId) ?? 0) + d._count.id);
  }
  for (const g of aktifGorev) {
    yukByVehicle.set(g.vehicleId, (yukByVehicle.get(g.vehicleId) ?? 0) + g._count.id);
  }
  const sonYakitByVehicle = new Map(sonYakitlar.map((y) => [y.vehicleId, y.tarih]));
  const birimFiyat = Number(sonBirim?.birimFiyat ?? 0);

  const maxSure = Math.max(...rotali.map((r) => r.rota.sureDk), 1);
  const maliyetler = rotali.map(({ arac, rota: yol }) => {
    const norm = arac.normTuketim ?? 0;
    return norm > 0 && birimFiyat > 0 ? (yol.mesafeKm * norm) / 100 * birimFiyat : 0;
  });
  const maxMaliyet = Math.max(...maliyetler, 1);
  const maxYuk = Math.max(...vehicleIds.map((id) => yukByVehicle.get(id) ?? 0), 1);

  const skorlu: DispatchAday[] = rotali.map(({ arac, rota: yol }, i) => {
    const tipUyumlu = TIP_REGEX[tip].test(arac.vehicleType?.name ?? "");
    const tipSkor = tipUyumlu ? 1 : 0;

    const yasMs = arac.sonKonumZamani
      ? now - arac.sonKonumZamani.getTime()
      : KONUM_TAZELIK_MS * 4;
    // 15 dk içi 1, 60 dk'da 0'a doğru düşer
    const tazelikSkor = Math.max(0, 1 - yasMs / (KONUM_TAZELIK_MS * 4));

    const yuk = yukByVehicle.get(arac.id) ?? 0;
    const yukSkor = normalizeTers(yuk, maxYuk);

    const maliyet = maliyetler[i];
    let yakitSkor =
      maliyet > 0 ? normalizeTers(maliyet, maxMaliyet) : 0.7; // norm yoksa nötr
    const sonYakit = sonYakitByVehicle.get(arac.id);
    if (sonYakit && now - sonYakit.getTime() > YAKIT_KAYIT_ESIK_MS) {
      yakitSkor *= 0.85;
    } else if (!sonYakit) {
      yakitSkor *= 0.9;
    }

    const sureSkor = normalizeTers(yol.sureDk, maxSure);

    const kirilim: SkorKirilim = {
      sure: Math.round(sureSkor * 100),
      tip: Math.round(tipSkor * 100),
      tazelik: Math.round(tazelikSkor * 100),
      yuk: Math.round(yukSkor * 100),
      yakit: Math.round(yakitSkor * 100),
    };

    const skor =
      (sureSkor * AGIRLIK.sure +
        tipSkor * AGIRLIK.tip +
        tazelikSkor * AGIRLIK.tazelik +
        yukSkor * AGIRLIK.yuk +
        yakitSkor * AGIRLIK.yakit) *
      100;

    const etiketler: string[] = [];
    if (tipUyumlu) etiketler.push("tip uyumlu");
    else etiketler.push("tip zayıf");
    if (yasMs <= KONUM_TAZELIK_MS) etiketler.push("taze konum");
    else etiketler.push("bayat konum");
    if (yuk === 0) etiketler.push("bugün boş");
    if (maliyet > 0 && yakitSkor >= 0.7) etiketler.push("düşük yakıt maliyeti");
    if (yol.tahmini) etiketler.push("kuş uçuşu tahmini");

    return {
      vehicleId: arac.id,
      plaka: arac.plaka,
      tip: arac.vehicleType?.name ?? null,
      sureDk: yol.sureDk,
      mesafeKm: yol.mesafeKm,
      tahmini: yol.tahmini,
      skor: Math.round(skor * 10) / 10,
      kirilim,
      etiketler,
      rota: yol.koordinatlar,
    };
  });

  // Tip uyumlu olanlar önce (aynı skor bandında), sonra genel skor
  skorlu.sort((a, b) => {
    const tipA = a.kirilim.tip;
    const tipB = b.kirilim.tip;
    if (tipA !== tipB) return tipB - tipA;
    return b.skor - a.skor;
  });

  return { routeAd: rota.ad, adaylar: skorlu.slice(0, MAX_ADAY) };
}

/**
 * En iyi adaydan ONERILDI DispatchJob üretir.
 * Aynı rota için bekleyen öneri varsa onu döndürür.
 */
export async function enYakinAracOner(
  tip: DispatchTip,
  routeId: string,
  opts: { excludeVehicleIds?: string[] } = {},
): Promise<DispatchOneri | null> {
  const exclude = new Set(opts.excludeVehicleIds ?? []);
  const mevcut = await prisma.dispatchJob.findFirst({
    where: { tip, routeId, durum: "ONERILDI" },
    include: { vehicle: { select: { plaka: true, vehicleType: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  // Aynı turda zaten kullanılan araca ait eski öneriyi yok say (yeniden skorla)
  if (
    mevcut?.vehicleId &&
    mevcut.vehicle &&
    !exclude.has(mevcut.vehicleId)
  ) {
    const g = mevcut.gerekce as DispatchGerekce | null;
    return {
      jobId: mevcut.id,
      tip,
      routeId,
      routeAd: mevcut.routeAd,
      vehicleId: mevcut.vehicleId,
      plaka: mevcut.vehicle.plaka,
      aracTip: mevcut.vehicle.vehicleType?.name ?? null,
      mesafeKm: mevcut.mesafeKm ?? 0,
      sureDk: mevcut.sureDk ?? 0,
      tahmini: mevcut.tahmini,
      gerekce: g,
    };
  }
  if (mevcut && mevcut.vehicleId && exclude.has(mevcut.vehicleId)) {
    await prisma.dispatchJob.update({
      where: { id: mevcut.id },
      data: { durum: "REDDEDILDI" },
    });
  }

  const { routeAd, adaylar } = await adaylariSkorla(tip, routeId, opts);
  const secilen = adaylar[0];
  if (!secilen) return null;

  const gerekce: DispatchGerekce = {
    skor: secilen.skor,
    kirilim: secilen.kirilim,
    etiketler: secilen.etiketler,
  };

  const job = await prisma.dispatchJob.create({
    data: {
      tip,
      routeId,
      routeAd,
      vehicleId: secilen.vehicleId,
      durum: "ONERILDI",
      rota: secilen.rota,
      mesafeKm: secilen.mesafeKm,
      sureDk: secilen.sureDk,
      tahmini: secilen.tahmini,
      gerekce: gerekce as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    jobId: job.id,
    tip,
    routeId,
    routeAd,
    vehicleId: secilen.vehicleId,
    plaka: secilen.plaka,
    aracTip: secilen.tip,
    mesafeKm: secilen.mesafeKm,
    sureDk: secilen.sureDk,
    tahmini: secilen.tahmini,
    gerekce,
  };
}

/** Belirli bir adayı seçerek öneri/job oluştur (UI Ata butonu) */
export async function aracOner(
  tip: DispatchTip,
  routeId: string,
  vehicleId: string,
): Promise<DispatchOneri | null> {
  const { routeAd, adaylar } = await adaylariSkorla(tip, routeId);
  const secilen = adaylar.find((a) => a.vehicleId === vehicleId);
  if (!secilen) {
    // Listede yoksa (bayat/musait değişti) yeniden skorla ve o aracı zorla dene
    return null;
  }

  // Aynı rota için eski ONERILDI varsa reddet (yenisi yazılacak)
  await prisma.dispatchJob.updateMany({
    where: { tip, routeId, durum: "ONERILDI" },
    data: { durum: "REDDEDILDI" },
  });

  const gerekce: DispatchGerekce = {
    skor: secilen.skor,
    kirilim: secilen.kirilim,
    etiketler: secilen.etiketler,
  };

  const job = await prisma.dispatchJob.create({
    data: {
      tip,
      routeId,
      routeAd,
      vehicleId: secilen.vehicleId,
      durum: "ONERILDI",
      rota: secilen.rota,
      mesafeKm: secilen.mesafeKm,
      sureDk: secilen.sureDk,
      tahmini: secilen.tahmini,
      gerekce: gerekce as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    jobId: job.id,
    tip,
    routeId,
    routeAd,
    vehicleId: secilen.vehicleId,
    plaka: secilen.plaka,
    aracTip: secilen.tip,
    mesafeKm: secilen.mesafeKm,
    sureDk: secilen.sureDk,
    tahmini: secilen.tahmini,
    gerekce,
  };
}

export async function dispatchAta(
  jobId: string,
  atayan: { id: string; name: string },
): Promise<{ gorevNo: string; taskId: string }> {
  const job = await prisma.dispatchJob.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      vehicle: { select: { id: true, plaka: true, atananSoforId: true } },
    },
  });
  if (job.durum !== "ONERILDI") throw new Error("Öneri zaten sonuçlandırılmış");
  if (!job.vehicle) throw new Error("Öneride araç yok");

  const arac = job.vehicle;
  const tipLabel = job.tip === "KIS" ? "Kış operasyonu" : "Çöp toplama";
  const cikis = new Date();

  const created = await withSerialRetry(prisma, async (tx) => {
    const guncel = await tx.vehicle.findUniqueOrThrow({
      where: { id: arac.id },
      select: { operasyonDurumu: true },
    });
    if (guncel.operasyonDurumu !== "MUSAIT") {
      throw new Error(`${arac.plaka} artık müsait değil — yeni öneri isteyin`);
    }

    const { yil, sira, gorevNo } = await nextTaskSerial(tx);
    const gorev = await tx.vehicleTask.create({
      data: {
        gorevNo,
        yil,
        sira,
        vehicleId: arac.id,
        gorevYeri: job.routeAd,
        gorevTanimi: `${tipLabel}: ${job.routeAd}`,
        cikisTarihi: cikis,
        driverId: arac.atananSoforId ?? undefined,
        durum: "DEVAM_EDIYOR",
        dispatchJobId: job.id,
      },
    });
    await tx.vehicle.update({
      where: { id: arac.id },
      data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: cikis },
    });
    await tx.dispatchJob.update({
      where: { id: job.id },
      data: { durum: "ATANDI" },
    });
    return gorev;
  });

  const bildirilecekler = [
    ...(arac.atananSoforId ? [arac.atananSoforId] : []),
    ...(await kullaniciIdleri(["DEPARTMENT_MANAGER"])),
  ].filter((uid) => uid !== atayan.id);
  await bildirimGonder(bildirilecekler, {
    tip: "ATAMA",
    baslik: `${tipLabel} ataması: ${created.gorevNo}`,
    mesaj: `${arac.plaka} → ${job.routeAd} (tahmini varış ${job.sureDk ?? "?"} dk)`,
    href: "/gorevler",
  });

  return { gorevNo: created.gorevNo, taskId: created.id };
}

export async function dispatchReddet(jobId: string): Promise<void> {
  await prisma.dispatchJob.update({
    where: { id: jobId, durum: "ONERILDI" },
    data: { durum: "REDDEDILDI" },
  });
}

export async function gorevRotasi(taskId: string): Promise<YolRotasi | null> {
  const task = await prisma.vehicleTask.findUnique({
    where: { id: taskId },
    select: {
      dispatchJob: { select: { rota: true, mesafeKm: true, sureDk: true, tahmini: true } },
    },
  });
  const job = task?.dispatchJob;
  if (!job?.rota) return null;
  return {
    koordinatlar: job.rota as [number, number][],
    mesafeKm: job.mesafeKm ?? 0,
    sureDk: job.sureDk ?? 0,
    tahmini: job.tahmini,
  };
}

/** Gerekçe etiketlerini tek satıra çevir (panel) */
export function gerekceOzeti(g: DispatchGerekce | null | undefined): string | null {
  if (!g) return null;
  const parts = [
    `skor ${g.skor}`,
    ...g.etiketler.slice(0, 3),
  ];
  return parts.join(" · ");
}
