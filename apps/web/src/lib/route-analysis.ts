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

export type DispatchRotaKaynak = "snapshot" | "canli";

export type DispatchRota = {
  ad: string;
  koordinatlar: LatLng[];
  kaynak: DispatchRotaKaynak;
};

/**
 * Görevin servis rotası: önce atama anındaki anlık görüntü (rotaSnapshot),
 * yoksa güncel rota. Rota sonradan düzenlenirse rapor ile metrikler
 * birbirinden ayrışmasın diye snapshot önceliklidir.
 */
export async function dispatchRotasi(job: {
  tip: DispatchTip;
  routeId: string;
  routeAd: string;
  rotaSnapshot: unknown;
}): Promise<DispatchRota | null> {
  const snapshot = job.rotaSnapshot as LatLng[] | null;
  if (Array.isArray(snapshot) && snapshot.length >= 2) {
    return { ad: job.routeAd, koordinatlar: snapshot, kaynak: "snapshot" };
  }
  const canli = await rotaPolyline(job.tip, job.routeId);
  if (!canli) return null;
  return { ...canli, kaynak: "canli" };
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

  // Görev kapandığında canlı sapma cache'i bayat kalmasın
  rotaCache.delete(task.vehicleId);

  const rota = await dispatchRotasi(task.dispatchJob);
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

  // Atanan şoför dışında bir kullanıcıdan gelen ping analizi bozar; cihaz
  // kaynaklı (driverId boş) ping'ler dahil kalır.
  const yabanciPing =
    task.driverId != null &&
    pingler.some((p) => p.driverId != null && p.driverId !== task.driverId);
  const gecerliPingler =
    task.driverId == null
      ? pingler
      : pingler.filter((p) => p.driverId == null || p.driverId === task.driverId);

  const izler: IzNokta[] = gecerliPingler.map((p) => ({
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
      ? "Atanan şoför dışında bir kullanıcıdan konum verisi alındı; bu ping'ler analiz dışı bırakıldı."
      : null,
  };

  return prisma.routeTrackAnalysis.upsert({
    where: { taskId },
    update: data,
    create: { taskId, ...data },
  });
}

/** Görev kapanış akışlarını bozmadan analiz dener (hata yutar, loglar, bildirir) */
export async function gorevIziAnalizDene(taskId: string): Promise<void> {
  try {
    await gorevIziAnalizEt(taskId);
  } catch (e) {
    console.error("Rota takip analizi başarısız:", taskId, e);
    const adminler = await kullaniciIdleri(["ADMIN"]);
    await bildirimGonder(adminler, {
      tip: "SISTEM",
      baslik: "Rota takip analizi başarısız",
      mesaj: `Görev ${taskId} için analiz üretilemedi: ${
        e instanceof Error ? e.message : String(e)
      }`.slice(0, 200),
      href: `/gorevler/${taskId}/takip`,
      anahtar: `analiz-hata:${taskId}`,
    });
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

const ROTA_CACHE_TTL_MS = 60_000;
const rotaCache = new Map<string, AktifRotaCache>(); // vehicleId → cache

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
  const rota = await dispatchRotasi(task.dispatchJob);
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

/** Sapma uyarısını ilgili yönetici ve müdürlere gönderir */
async function sapmaUyar(params: {
  taskId: string;
  gorevNo: string;
  departmentId: string | null;
  baslangic: Date;
  sureDk: number;
  uzaklikM: number | null;
}): Promise<void> {
  const yoneticiler = await kullaniciIdleri(["ADMIN"]);
  const mudurler = params.departmentId
    ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], params.departmentId)
    : [];
  const mesafe =
    params.uzaklikM != null ? `~${Math.round(params.uzaklikM)} m sapmayla ` : "";
  await bildirimGonder([...yoneticiler, ...mudurler], {
    tip: "SLA",
    baslik: `${params.gorevNo}: araç rotanın dışında`,
    mesaj: `Araç ${mesafe}${Math.round(params.sureDk)} dk'dır rota dışında.`,
    href: `/gorevler/${params.taskId}/takip`,
    anahtar: `sapma:${params.taskId}:${params.baslangic.getTime()}`,
  });
}

/**
 * Her konum ping'inde çağrılır: araç aktif dispatch görevindeyse rotaya
 * uzaklık kontrol edilir; eşik üstü sapma sürerse yöneticilere bildirim gider.
 * Sapma durumu görev satırında tutulur (çok instance'lı çalışmada tutarlı).
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
    const simdi = new Date();
    const durum = await prisma.vehicleTask.findUnique({
      where: { id: aktif.taskId },
      select: { rotaDisiBaslangic: true, rotaDisiUyarildi: true, durum: true },
    });
    if (!durum) return;
    // Görev cache ömrü içinde kapandıysa eski rotayla karşılaştırma yapılmaz
    if (durum.durum !== "DEVAM_EDIYOR") {
      rotaCache.delete(vehicleId);
      return;
    }

    if (uzaklikM <= esik.sapmaUyariM) {
      // Rotaya döndü — sonraki çıkış yeni olay sayılır
      await prisma.vehicleTask.update({
        where: { id: aktif.taskId },
        data: {
          rotaDisiBaslangic: null,
          rotaDisiUyarildi: false,
          sonSapmaKontrol: simdi,
        },
      });
      return;
    }

    if (!durum.rotaDisiBaslangic) {
      await prisma.vehicleTask.update({
        where: { id: aktif.taskId },
        data: {
          rotaDisiBaslangic: simdi,
          rotaDisiUyarildi: false,
          sonSapmaKontrol: simdi,
        },
      });
      return;
    }

    const sureDk = (simdi.getTime() - durum.rotaDisiBaslangic.getTime()) / 60000;
    if (sureDk < esik.sapmaUyariDk || durum.rotaDisiUyarildi) {
      await prisma.vehicleTask.update({
        where: { id: aktif.taskId },
        data: { sonSapmaKontrol: simdi },
      });
      return;
    }

    await prisma.vehicleTask.update({
      where: { id: aktif.taskId },
      data: { rotaDisiUyarildi: true, sonSapmaKontrol: simdi },
    });
    await sapmaUyar({
      taskId: aktif.taskId,
      gorevNo: aktif.gorevNo,
      departmentId: aktif.departmentId,
      baslangic: durum.rotaDisiBaslangic,
      sureDk,
      uzaklikM,
    });
  } catch (e) {
    console.error("Canlı sapma kontrolü hatası:", vehicleId, e);
  }
}

/**
 * Ping akışından bağımsız tarama: araç rota dışına çıkıp ping göndermeyi
 * kesse bile eşiği aşan sapmalar uyarılır. Komuta ekranından best-effort ve
 * dışarıdan cron ile tetiklenir.
 */
export async function sapmaTaramasi(): Promise<{ uyarilan: number }> {
  const esik = await analizEsikleri();
  const sinir = new Date(Date.now() - esik.sapmaUyariDk * 60_000);

  const gorevler = await prisma.vehicleTask.findMany({
    where: {
      durum: "DEVAM_EDIYOR",
      dispatchJobId: { not: null },
      rotaDisiUyarildi: false,
      rotaDisiBaslangic: { not: null, lte: sinir },
    },
    select: {
      id: true,
      gorevNo: true,
      rotaDisiBaslangic: true,
      talepEdenDepartmentId: true,
      vehicle: { select: { departmentId: true } },
    },
    take: 100,
  });

  let uyarilan = 0;
  for (const g of gorevler) {
    if (!g.rotaDisiBaslangic) continue;
    // Yalnız hâlâ uyarılmamış olanı sahiplen (eşzamanlı tarama çift uyarmasın)
    const claim = await prisma.vehicleTask.updateMany({
      where: { id: g.id, rotaDisiUyarildi: false },
      data: { rotaDisiUyarildi: true },
    });
    if (claim.count === 0) continue;

    await sapmaUyar({
      taskId: g.id,
      gorevNo: g.gorevNo,
      departmentId: g.talepEdenDepartmentId ?? g.vehicle?.departmentId ?? null,
      baslangic: g.rotaDisiBaslangic,
      sureDk: (Date.now() - g.rotaDisiBaslangic.getTime()) / 60000,
      uzaklikM: null,
    });
    uyarilan += 1;
  }

  return { uyarilan };
}

/** Tarama en fazla bu sıklıkla çalışır (ayrı cron zorunlu olmasın diye) */
const SAPMA_TARAMA_ARALIGI_MS = 60_000;
let sonSapmaTaramasi = 0;

/** Komuta yenilemesinden best-effort tetikleme: throttle'lı ve hata yutar */
export async function sapmaTaramasiDene(): Promise<void> {
  const simdi = Date.now();
  if (simdi - sonSapmaTaramasi < SAPMA_TARAMA_ARALIGI_MS) return;
  sonSapmaTaramasi = simdi;
  try {
    await sapmaTaramasi();
  } catch (e) {
    console.error("Sapma taraması hatası:", e);
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
