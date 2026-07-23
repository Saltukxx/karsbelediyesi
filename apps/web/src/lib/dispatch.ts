import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import type { DispatchTip } from "@kars/db";
import { KONUM_TAZELIK_MS, kusUcusuKm } from "@/lib/location";
import { yolRotasi, type YolRotasi } from "@/lib/routing";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

/**
 * Dispatch motoru: iş doğduğunda (kış rotası gecikti / çöp rotası bekliyor)
 * canlı konumu taze, müsait ve tipe uygun araçlardan en yakınını seçer.
 * Seçim: haversine ile ilk 5 aday → OSRM yol süresiyle sırala → en yakın.
 */

export const OTOMATIK_ATAMA_KEY = "dispatchOtomatikAtama";

/** Araç tipi adı, operasyon tipine uygun mu? (regex eşleşmesi) */
const TIP_REGEX: Record<DispatchTip, RegExp> = {
  KIS: /kar|tuz|grey|k[üu]re|kep[çc]e|greyder|dozer/i,
  COP: /[çc][öo]p|s[ıi]k[ıi][şs]t[ıi]rma|hidrolik/i,
};

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

/** Rota bilgisi (tip'e göre Winter/Waste tablosundan) */
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

/**
 * Rota için en yakın uygun aracı bulur ve ONERILDI durumunda DispatchJob yazar.
 * Aynı rota için çözülmemiş (ONERILDI) bir öneri varsa onu döndürür (tekrar üretmez).
 * Uygun araç yoksa null döner.
 */
export async function enYakinAracOner(
  tip: DispatchTip,
  routeId: string,
): Promise<DispatchOneri | null> {
  const rota = await rotaYukle(tip, routeId);
  if (!rota) return null;

  // Bekleyen öneri varsa yenisini üretme
  const mevcut = await prisma.dispatchJob.findFirst({
    where: { tip, routeId, durum: "ONERILDI" },
    include: { vehicle: { select: { plaka: true, vehicleType: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  if (mevcut?.vehicleId && mevcut.vehicle) {
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
    };
  }

  const [hedefLat, hedefLng] = rota.baslangic;

  // Aday filtre: müsait + aktif + taze konum
  const adaylar = await prisma.vehicle.findMany({
    where: {
      operasyonDurumu: "MUSAIT",
      envanterDurumu: "AKTIF",
      sonKonumLat: { not: null },
      sonKonumLng: { not: null },
      sonKonumZamani: { gte: new Date(Date.now() - KONUM_TAZELIK_MS) },
    },
    select: {
      id: true,
      plaka: true,
      sonKonumLat: true,
      sonKonumLng: true,
      atananSoforId: true,
      vehicleType: { select: { name: true } },
    },
  });
  if (adaylar.length === 0) return null;

  // Tipe uygun araç varsa yalnız onlar; yoksa (küçük filo pratiği) tüm müsaitler
  const tipUygun = adaylar.filter((a) => TIP_REGEX[tip].test(a.vehicleType?.name ?? ""));
  const havuz = tipUygun.length > 0 ? tipUygun : adaylar;

  // Haversine ile ilk 5'e indir
  const ilk5 = havuz
    .map((a) => ({
      arac: a,
      kusUcusu: kusUcusuKm(a.sonKonumLat as number, a.sonKonumLng as number, hedefLat, hedefLng),
    }))
    .sort((x, y) => x.kusUcusu - y.kusUcusu)
    .slice(0, 5);

  // OSRM yol süresiyle sırala
  const rotali = await Promise.all(
    ilk5.map(async ({ arac }) => ({
      arac,
      rota: await yolRotasi(
        arac.sonKonumLat as number,
        arac.sonKonumLng as number,
        hedefLat,
        hedefLng,
      ),
    })),
  );
  rotali.sort((x, y) => x.rota.sureDk - y.rota.sureDk);
  const secilen = rotali[0];

  const job = await prisma.dispatchJob.create({
    data: {
      tip,
      routeId,
      routeAd: rota.ad,
      vehicleId: secilen.arac.id,
      durum: "ONERILDI",
      rota: secilen.rota.koordinatlar,
      mesafeKm: secilen.rota.mesafeKm,
      sureDk: secilen.rota.sureDk,
      tahmini: secilen.rota.tahmini,
    },
  });

  return {
    jobId: job.id,
    tip,
    routeId,
    routeAd: rota.ad,
    vehicleId: secilen.arac.id,
    plaka: secilen.arac.plaka,
    aracTip: secilen.arac.vehicleType?.name ?? null,
    mesafeKm: secilen.rota.mesafeKm,
    sureDk: secilen.rota.sureDk,
    tahmini: secilen.rota.tahmini,
  };
}

/**
 * Öneriyi göreve dönüştürür: VehicleTask oluşturur (DEVAM_EDIYOR),
 * aracı GOREVDE yapar, job'u ATANDI işaretler, şoföre bildirim gönderir.
 */
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

/** Öneriyi reddet (yeni tarama tekrar öneri üretebilir) */
export async function dispatchReddet(jobId: string): Promise<void> {
  await prisma.dispatchJob.update({
    where: { id: jobId, durum: "ONERILDI" },
    data: { durum: "REDDEDILDI" },
  });
}

/** Şoförün göreve gidiş rotası (mobil API için) */
export async function gorevRotasi(taskId: string): Promise<YolRotasi | null> {
  const task = await prisma.vehicleTask.findUnique({
    where: { id: taskId },
    select: { dispatchJob: { select: { rota: true, mesafeKm: true, sureDk: true, tahmini: true } } },
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
