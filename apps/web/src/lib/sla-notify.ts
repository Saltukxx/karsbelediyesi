import { prisma } from "@kars/db";
import type { DispatchTip } from "@kars/db";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import { dispatchAta, enYakinAracOner, otomatikAtamaAcikMi } from "@/lib/dispatch";

/** SLA eşiği: bu süreden uzun süredir AÇIK kalan şikayetler bildirilir */
const SLA_SAAT = 24;
/** Tarama en fazla bu sıklıkla çalışır (ayrı cron kurmamak için modül içi kilit) */
const TARAMA_ARALIGI_MS = 10 * 60 * 1000;

let sonTarama = 0;

export interface SlaTaramaSonucu {
  /** Kısıtlama nedeniyle atlandıysa false — sayılar 0 gelir */
  calisti: boolean;
  /** SLA'yı aşmış açık şikayet sayısı */
  sikayet: number;
  gecikenKisRota: number;
  gecikenCopRota: number;
  zaman: string;
}

/**
 * 24 saatten uzun süredir AÇIK şikayetler için müdürlük yöneticisi + admin'e
 * bildirim üretir. Notification.anahtar sayesinde aynı şikayet için tekrar
 * bildirim oluşmaz. Bildirim uçları içinden tetiklenir; `zorla` yalnız
 * elle çalıştırma (yönetici / cron) içindir.
 */
export async function slaTaramasiCalistir(
  opts: { zorla?: boolean } = {},
): Promise<SlaTaramaSonucu> {
  const simdi = Date.now();
  if (!opts.zorla && simdi - sonTarama < TARAMA_ARALIGI_MS) {
    return {
      calisti: false,
      sikayet: 0,
      gecikenKisRota: 0,
      gecikenCopRota: 0,
      zaman: new Date(simdi).toISOString(),
    };
  }
  sonTarama = simdi;

  let sikayet = 0;
  try {
    const esik = new Date(simdi - SLA_SAAT * 60 * 60 * 1000);
    const gecikenler = await prisma.complaint.findMany({
      where: { durum: "ACIK", kayitTarihi: { lt: esik } },
      select: { id: true, sikayetNo: true, departmentId: true },
      take: 50,
    });
    sikayet = gecikenler.length;

    if (gecikenler.length > 0) {
      const adminler = await kullaniciIdleri(["ADMIN"]);
      for (const s of gecikenler) {
        const yoneticiler = s.departmentId
          ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], s.departmentId)
          : [];
        await bildirimGonder([...adminler, ...yoneticiler], {
          tip: "SLA",
          baslik: `SLA aşımı: ${s.sikayetNo}`,
          mesaj: `Şikayet ${SLA_SAAT} saatten uzun süredir açık.`,
          href: `/sikayetler/${s.id}`,
          anahtar: `sla:${s.sikayetNo}`,
        });
      }
    }
  } catch (e) {
    console.error("SLA taraması başarısız:", e);
  }

  const gecikenKisRota = await kisRotaTaramasi(simdi);
  const gecikenCopRota = await copRotaTaramasi(simdi);

  return {
    calisti: true,
    sikayet,
    gecikenKisRota,
    gecikenCopRota,
    zaman: new Date(simdi).toISOString(),
  };
}

/**
 * Geciken rota için dispatch önerisi; aynı turda kullanılan araçlar exclude edilir.
 */
async function dispatchOnerisiUret(
  tip: DispatchTip,
  routeId: string,
  otomatik: boolean,
  excludeVehicleIds: string[],
): Promise<{ not: string; vehicleId: string } | null> {
  try {
    const oneri = await enYakinAracOner(tip, routeId, { excludeVehicleIds });
    if (!oneri) return null;
    if (otomatik) {
      const { gorevNo } = await dispatchAta(oneri.jobId, {
        id: "",
        name: "Otomatik atama",
      });
      return {
        not: `${oneri.plaka} otomatik atandı (${gorevNo}, ~${oneri.sureDk} dk)`,
        vehicleId: oneri.vehicleId,
      };
    }
    return {
      not: `Öneri: ${oneri.plaka} (~${oneri.sureDk} dk, skor ${oneri.gerekce?.skor ?? "?"})`,
      vehicleId: oneri.vehicleId,
    };
  } catch (e) {
    console.error("Dispatch önerisi üretilemedi:", e);
    return null;
  }
}

const KIS_ESIK_ONCELIK1_SAAT = 12;
const KIS_ESIK_ONCELIK2_SAAT = 18;

export interface GecikenKisRota {
  id: string;
  ad: string;
  oncelik: number;
  esikSaat: number;
  /** Son operasyon başlangıcı (hiç yoksa null) */
  sonIslem: Date | null;
  koordinatlar: [number, number][];
}

/**
 * Kış sezonunda eşiği aşan öncelik-1 (12 sa) ve öncelik-2 (18 sa) rotalar.
 * Salt okunur — bildirim/atama üretmez; hem tarama hem komuta ekranı kullanır.
 * Sezon dışında boş liste döner.
 */
export async function gecikenKisRotalari(simdi: number): Promise<GecikenKisRota[]> {
  const ay = new Date(simdi).getMonth();
  const kisSezonu = ay >= 9 || ay <= 3;
  if (!kisSezonu) return [];

  const rotalar = await prisma.winterRoute.findMany({
    where: { aktif: true, oncelik: { in: [1, 2] } },
    orderBy: { oncelik: "asc" },
    select: {
      id: true,
      ad: true,
      oncelik: true,
      koordinatlar: true,
      operations: {
        orderBy: { baslangic: "desc" },
        take: 1,
        select: { baslangic: true },
      },
    },
  });

  return rotalar
    .map((r) => ({
      id: r.id,
      ad: r.ad,
      oncelik: r.oncelik,
      esikSaat: r.oncelik === 1 ? KIS_ESIK_ONCELIK1_SAAT : KIS_ESIK_ONCELIK2_SAAT,
      sonIslem: r.operations[0]?.baslangic ?? null,
      koordinatlar: (r.koordinatlar as [number, number][]) ?? [],
    }))
    .filter((r) => {
      const esik = simdi - r.esikSaat * 60 * 60 * 1000;
      return !r.sonIslem || r.sonIslem.getTime() < esik;
    });
}

/**
 * Kış sezonunda geciken öncelik-1 (12 sa) ve öncelik-2 (18 sa) rotalar.
 * Öncelik-1 önce işlenir; aynı araç aynı turda ikinci rotaya önerilmez.
 */
async function kisRotaTaramasi(simdi: number): Promise<number> {
  try {
    const gecikenler = await gecikenKisRotalari(simdi);
    if (gecikenler.length === 0) return 0;

    const otomatik = await otomatikAtamaAcikMi();
    const ilgililer = await kullaniciIdleri(["ADMIN", "DEPARTMENT_MANAGER"]);
    const gun = new Date(simdi).toISOString().slice(0, 10);
    const kullanilanAraclar: string[] = [];

    for (const r of gecikenler) {
      const sonuc = await dispatchOnerisiUret("KIS", r.id, otomatik, kullanilanAraclar);
      if (sonuc) kullanilanAraclar.push(sonuc.vehicleId);
      await bildirimGonder(ilgililer, {
        tip: "SLA",
        baslik: `Kış rotası bekliyor: ${r.ad}`,
        mesaj: `Öncelik-${r.oncelik} rota ${r.esikSaat} saatten uzun süredir işlem görmedi.${
          sonuc ? ` ${sonuc.not}.` : ""
        }`,
        href: "/kis",
        anahtar: `kis:${r.id}:${gun}`,
      });
    }
    return gecikenler.length;
  } catch (e) {
    console.error("Kış rota taraması başarısız:", e);
    return 0;
  }
}

/** İlk uyarı 09:00; öğleden sonra (14:00+) ikinci tarama penceresi aynı anahtarla spam üretmez */
const COP_UYARI_SAATI = 9;

export interface GecikenCopRota {
  id: string;
  ad: string;
  /** Bugünkü son toplama (yoksa null) */
  sonIslem: Date | null;
  koordinatlar: [number, number][];
}

/**
 * Bugün toplanması gerekip henüz toplanmamış çöp rotaları (09:00'dan itibaren).
 * Salt okunur — bildirim/atama üretmez; hem tarama hem komuta ekranı kullanır.
 */
export async function gecikenCopRotalari(simdi: number): Promise<GecikenCopRota[]> {
  const bugun = new Date(simdi);
  if (bugun.getHours() < COP_UYARI_SAATI) return [];
  const isoGun = bugun.getDay() === 0 ? 7 : bugun.getDay();
  const bugunBasi = new Date(simdi);
  bugunBasi.setHours(0, 0, 0, 0);

  const rotalar = await prisma.wasteRoute.findMany({
    where: { aktif: true },
    orderBy: { oncelik: "asc" },
    select: {
      id: true,
      ad: true,
      gunler: true,
      koordinatlar: true,
      collections: {
        orderBy: { baslangic: "desc" },
        take: 1,
        select: { baslangic: true },
      },
    },
  });
  return rotalar
    .filter((r) => {
      const gunler = (r.gunler as number[]) ?? [];
      if (!gunler.includes(isoGun)) return false;
      const son = r.collections[0]?.baslangic;
      return !son || son < bugunBasi;
    })
    .map((r) => ({
      id: r.id,
      ad: r.ad,
      sonIslem: r.collections[0]?.baslangic ?? null,
      koordinatlar: (r.koordinatlar as [number, number][]) ?? [],
    }));
}

async function copRotaTaramasi(simdi: number): Promise<number> {
  try {
    const bugun = new Date(simdi);
    const gecikenler = await gecikenCopRotalari(simdi);
    if (gecikenler.length === 0) return 0;

    const otomatik = await otomatikAtamaAcikMi();
    const ilgililer = await kullaniciIdleri(["ADMIN", "DEPARTMENT_MANAGER"]);
    const gun = bugun.toISOString().slice(0, 10);
    const kullanilanAraclar: string[] = [];

    for (const r of gecikenler) {
      const sonuc = await dispatchOnerisiUret("COP", r.id, otomatik, kullanilanAraclar);
      if (sonuc) kullanilanAraclar.push(sonuc.vehicleId);
      await bildirimGonder(ilgililer, {
        tip: "SLA",
        baslik: `Çöp rotası bekliyor: ${r.ad}`,
        mesaj: `Bugün toplanması gereken rota henüz toplanmadı.${
          sonuc ? ` ${sonuc.not}.` : ""
        }`,
        href: "/cop",
        anahtar: `cop:${r.id}:${gun}`,
      });
    }
    return gecikenler.length;
  } catch (e) {
    console.error("Çöp rota taraması başarısız:", e);
    return 0;
  }
}
