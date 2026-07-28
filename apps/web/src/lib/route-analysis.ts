import { prisma } from "@kars/db";
import type { AnalizSonuc, AnalizVeriKalite, DispatchTip } from "@kars/db";
import {
  duraklamaBul,
  hizIstatistik,
  izMesafeKm,
  ortPingAraligiSn,
  rotaGirisCikis,
  rotaKapsama,
  rotaUyum,
  rotayaUzaklikM,
  sapmaBul,
  veriBoslukBul,
  type IzNokta,
  type LatLng,
} from "@/lib/geo-track";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

/**
 * Rota takip analizi: görev sonrası GPS izi ↔ çizilen rota karşılaştırması
 * ve görev sürerken canlı rota-dışı sapma kontrolü.
 */

// ── Eşikler (AppSetting ile ayarlanabilir, kod içi varsayılanlar) ──

const ESIK_VARSAYILAN = {
  /** Rotada sayılma buffer'ı (m) */
  rotaBufferM: 60,
  /** Canlı sapma uyarısı mesafe eşiği (m) */
  sapmaUyariM: 150,
  /** Canlı sapma uyarısı süre eşiği (dk) */
  sapmaUyariDk: 3,
  /** Duraklama sayılması için minimum süre (dk) */
  duraklamaMinDk: 3,
} as const;

export type AnalizEsikleri = { -readonly [K in keyof typeof ESIK_VARSAYILAN]: number };

export async function analizEsikleri(): Promise<AnalizEsikleri> {
  const sonuc: AnalizEsikleri = { ...ESIK_VARSAYILAN };
  try {
    const satirlar = await prisma.appSetting.findMany({
      where: { key: { in: Object.keys(ESIK_VARSAYILAN) } },
    });
    for (const s of satirlar) {
      const n = Number(s.value);
      if (Number.isFinite(n) && n > 0) sonuc[s.key as keyof AnalizEsikleri] = n;
    }
  } catch {
    // Ayar okunamazsa varsayılanlar kullanılır
  }
  return sonuc;
}

// ── Rota yükleme (polimorfik DispatchJob.routeId) ──

async function rotaPolyline(
  tip: DispatchTip,
  routeId: string,
): Promise<{ ad: string; koordinatlar: LatLng[] } | null> {
  let route: { ad: string; koordinatlar: unknown } | null;
  switch (tip) {
    case "KIS":
      route = await prisma.winterRoute.findUnique({
        where: { id: routeId },
        select: { ad: true, koordinatlar: true },
      });
      break;
    case "COP":
      route = await prisma.wasteRoute.findUnique({
        where: { id: routeId },
        select: { ad: true, koordinatlar: true },
      });
      break;
    case "TEMIZLIK":
      route = await prisma.cleaningRoute.findUnique({
        where: { id: routeId },
        select: { ad: true, koordinatlar: true },
      });
      break;
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }
  if (!route) return null;
  const koordinatlar = route.koordinatlar as LatLng[];
  if (!Array.isArray(koordinatlar) || koordinatlar.length < 2) return null;
  return { ad: route.ad, koordinatlar };
}

// ── Görev sonrası analiz ──

function sonucHukmu(
  kapsamaYuzde: number,
  uyumYuzde: number,
  pingSayisi: number,
): AnalizSonuc {
  if (pingSayisi === 0) return "VERI_YOK";
  if (kapsamaYuzde >= 90 && uyumYuzde >= 80) return "TAMAMLANDI";
  if (kapsamaYuzde >= 60) return "KISMEN";
  return "YETERSIZ";
}

function veriKalitesiHukmu(
  pingSayisi: number,
  ortAralikSn: number | null,
): AnalizVeriKalite {
  if (pingSayisi === 0) return "YOK";
  // Ortalama ping aralığı ≤ 2 dk ve ≥ 10 ping → güvenilir
  if (pingSayisi >= 10 && ortAralikSn != null && ortAralikSn <= 120) return "IYI";
  return "ZAYIF";
}

/**
 * Dispatch'e bağlı bir görevin GPS izini rota ile karşılaştırıp
 * RouteTrackAnalysis kaydını üretir/günceller.
 * Dispatch'e bağlı olmayan görevlerde null döner.
 */
export async function gorevIziAnalizEt(taskId: string) {
  const task = await prisma.vehicleTask.findUnique({
    where: { id: taskId },
    include: { dispatchJob: true },
  });
  if (!task?.dispatchJob || !task.cikisTarihi) return null;

  const rota = await rotaPolyline(task.dispatchJob.tip, task.dispatchJob.routeId);
  if (!rota) return null;

  const esik = await analizEsikleri();
  const bitis = task.girisTarihi ?? new Date();

  const pingler = await prisma.vehicleLocation.findMany({
    where: {
      vehicleId: task.vehicleId,
      zaman: { gte: task.cikisTarihi, lte: bitis },
    },
    orderBy: { zaman: "asc" },
    select: { lat: true, lng: true, hiz: true, zaman: true, driverId: true },
  });

  const izler: IzNokta[] = pingler.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    zamanMs: p.zaman.getTime(),
    hiz: p.hiz,
  }));

  const kapsama = rotaKapsama(rota.koordinatlar, izler, esik.rotaBufferM);
  const uyum = rotaUyum(rota.koordinatlar, izler, esik.rotaBufferM);
  const sapmalar = sapmaBul(rota.koordinatlar, izler, esik.rotaBufferM, 2);
  const duraklamalar = duraklamaBul(
    izler,
    esik.duraklamaMinDk,
    rota.koordinatlar,
    esik.rotaBufferM,
  );
  const bosluklar = veriBoslukBul(izler, 5);
  const ortAralik = ortPingAraligiSn(izler);
  const girisCikis = rotaGirisCikis(rota.koordinatlar, izler, esik.rotaBufferM);
  const hiz = hizIstatistik(izler);

  // Atanan şoför dışında ping var mı?
  const yabanciPing =
    task.driverId != null &&
    pingler.some((p) => p.driverId != null && p.driverId !== task.driverId);

  const data = {
    tip: task.dispatchJob.tip,
    routeId: task.dispatchJob.routeId,
    routeAd: rota.ad,
    vehicleId: task.vehicleId,
    driverId: task.driverId,
    rotaGiris: girisCikis.girisMs != null ? new Date(girisCikis.girisMs) : null,
    rotaCikis: girisCikis.cikisMs != null ? new Date(girisCikis.cikisMs) : null,
    sureDk: girisCikis.sureDk,
    uyumYuzde: uyum.uyumYuzde,
    kapsamaYuzde: kapsama.kapsamaYuzde,
    maxSapmaM: uyum.maxSapmaM,
    ortSapmaM: uyum.ortSapmaM,
    sapmalar: sapmalar as unknown as object[],
    ortalamaHizKmh: hiz.ortalamaKmh,
    maxHizKmh: hiz.maxKmh,
    toplamMesafeKm: izMesafeKm(izler),
    pingSayisi: izler.length,
    duraklamalar: duraklamalar as unknown as object[],
    veriBosluklari: bosluklar as unknown as object[],
    ortPingAraligiSn: ortAralik,
    veriKalitesi: veriKalitesiHukmu(izler.length, ortAralik),
    sonuc: sonucHukmu(kapsama.kapsamaYuzde, uyum.uyumYuzde, izler.length),
    izKoordinatlar: izler.map((iz) => [iz.lat, iz.lng, iz.zamanMs, iz.hiz]) as unknown as
      object[],
    eksikSegmentler: kapsama.eksikSegmentler as unknown as object[],
    notlar: yabanciPing
      ? "Atanan şoför dışında bir kullanıcıdan konum verisi alındı."
      : null,
  };

  return prisma.routeTrackAnalysis.upsert({
    where: { taskId },
    update: data,
    create: { taskId, ...data },
  });
}

/** Görev kapanış akışlarını bozmadan analiz dener (hata yutar, loglar) */
export async function gorevIziAnalizDene(taskId: string): Promise<void> {
  try {
    await gorevIziAnalizEt(taskId);
  } catch (e) {
    console.error("Rota takip analizi başarısız:", taskId, e);
  }
}

// ── Canlı rota-dışı sapma kontrolü (görev sürerken) ──

type AktifRotaCache = {
  taskId: string;
  gorevNo: string;
  departmentId: string | null;
  koordinatlar: LatLng[];
  yuklendiMs: number;
} | null;

type SapmaDurumu = { offSinceMs: number | null; uyarildi: boolean };

const ROTA_CACHE_TTL_MS = 60_000;
const rotaCache = new Map<string, AktifRotaCache>(); // vehicleId → cache
const sapmaDurumlari = new Map<string, SapmaDurumu>(); // taskId → durum

async function aktifRotaYukle(vehicleId: string): Promise<AktifRotaCache> {
  const cached = rotaCache.get(vehicleId);
  if (cached !== undefined && cached !== null) {
    if (Date.now() - cached.yuklendiMs < ROTA_CACHE_TTL_MS) return cached;
  } else if (cached === null) {
    // "aktif dispatch görevi yok" da kısa süre cache'lenir
    return null;
  }

  const task = await prisma.vehicleTask.findFirst({
    where: { vehicleId, durum: "DEVAM_EDIYOR", dispatchJobId: { not: null } },
    orderBy: { cikisTarihi: "desc" },
    include: { dispatchJob: true, vehicle: { select: { departmentId: true } } },
  });
  if (!task?.dispatchJob) {
    rotaCache.set(vehicleId, null);
    setTimeout(() => rotaCache.delete(vehicleId), ROTA_CACHE_TTL_MS).unref?.();
    return null;
  }
  const rota = await rotaPolyline(task.dispatchJob.tip, task.dispatchJob.routeId);
  if (!rota) {
    rotaCache.set(vehicleId, null);
    setTimeout(() => rotaCache.delete(vehicleId), ROTA_CACHE_TTL_MS).unref?.();
    return null;
  }
  const sonuc: AktifRotaCache = {
    taskId: task.id,
    gorevNo: task.gorevNo,
    departmentId: task.talepEdenDepartmentId ?? task.vehicle?.departmentId ?? null,
    koordinatlar: rota.koordinatlar,
    yuklendiMs: Date.now(),
  };
  rotaCache.set(vehicleId, sonuc);
  return sonuc;
}

/**
 * Her konum ping'inde çağrılır: araç aktif dispatch görevindeyse rotaya
 * uzaklık kontrol edilir; eşik üstü sapma sürerse yöneticilere bildirim gider.
 * Ping kaydını bozmamak için hata fırlatmaz.
 */
export async function canliSapmaKontrol(
  vehicleId: string,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    const aktif = await aktifRotaYukle(vehicleId);
    if (!aktif) return;

    const esik = await analizEsikleri();
    const uzaklikM = rotayaUzaklikM([lat, lng], aktif.koordinatlar);
    const durum = sapmaDurumlari.get(aktif.taskId) ?? {
      offSinceMs: null,
      uyarildi: false,
    };

    if (uzaklikM <= esik.sapmaUyariM) {
      // Rotaya döndü — sonraki çıkış yeni olay sayılır
      sapmaDurumlari.set(aktif.taskId, { offSinceMs: null, uyarildi: false });
      return;
    }

    const simdi = Date.now();
    if (durum.offSinceMs === null) {
      sapmaDurumlari.set(aktif.taskId, { offSinceMs: simdi, uyarildi: false });
      return;
    }

    const sureDk = (simdi - durum.offSinceMs) / 60000;
    if (sureDk >= esik.sapmaUyariDk && !durum.uyarildi) {
      sapmaDurumlari.set(aktif.taskId, { ...durum, uyarildi: true });
      const yoneticiler = await kullaniciIdleri(["ADMIN"]);
      const mudurler = aktif.departmentId
        ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], aktif.departmentId)
        : [];
      await bildirimGonder([...yoneticiler, ...mudurler], {
        tip: "SLA",
        baslik: `${aktif.gorevNo}: araç rotanın dışında`,
        mesaj: `Araç ~${Math.round(uzaklikM)} m sapmayla ${Math.round(sureDk)} dk'dır rota dışında.`,
        href: `/gorevler/${aktif.taskId}/takip`,
        anahtar: `sapma:${aktif.taskId}:${durum.offSinceMs}`,
      });
    }
  } catch (e) {
    console.error("Canlı sapma kontrolü hatası:", vehicleId, e);
  }
}

/** Komuta ekranı rozeti için: aracın aktif görev rotasına anlık uzaklığı */
export async function aracRotaUzakligi(
  vehicleId: string,
  lat: number,
  lng: number,
): Promise<{ taskId: string; uzaklikM: number; rotada: boolean } | null> {
  const aktif = await aktifRotaYukle(vehicleId);
  if (!aktif) return null;
  const esik = await analizEsikleri();
  const uzaklikM = Math.round(rotayaUzaklikM([lat, lng], aktif.koordinatlar));
  return { taskId: aktif.taskId, uzaklikM, rotada: uzaklikM <= esik.sapmaUyariM };
}
