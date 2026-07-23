import { prisma } from "@kars/db";
import type { DispatchTip } from "@kars/db";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import { dispatchAta, enYakinAracOner, otomatikAtamaAcikMi } from "@/lib/dispatch";

/** SLA eşiği: bu süreden uzun süredir AÇIK kalan şikayetler bildirilir */
const SLA_SAAT = 24;
/** Tarama en fazla bu sıklıkla çalışır (ayrı cron kurmamak için modül içi kilit) */
const TARAMA_ARALIGI_MS = 10 * 60 * 1000;

let sonTarama = 0;

/**
 * 24 saatten uzun süredir AÇIK şikayetler için müdürlük yöneticisi + admin'e
 * bildirim üretir. Notification.anahtar sayesinde aynı şikayet için tekrar
 * bildirim oluşmaz. /api/ops/notifications GET'i içinden tetiklenir.
 */
export async function slaTaramasiCalistir(): Promise<void> {
  const simdi = Date.now();
  if (simdi - sonTarama < TARAMA_ARALIGI_MS) return;
  sonTarama = simdi;

  try {
    const esik = new Date(simdi - SLA_SAAT * 60 * 60 * 1000);
    const gecikenler = await prisma.complaint.findMany({
      where: { durum: "ACIK", kayitTarihi: { lt: esik } },
      select: { id: true, sikayetNo: true, departmentId: true },
      take: 50,
    });

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

  await kisRotaTaramasi(simdi);
  await copRotaTaramasi(simdi);
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

/**
 * Kış sezonunda geciken öncelik-1 (12 sa) ve öncelik-2 (18 sa) rotalar.
 * Öncelik-1 önce işlenir; aynı araç aynı turda ikinci rotaya önerilmez.
 */
async function kisRotaTaramasi(simdi: number): Promise<void> {
  try {
    const ay = new Date(simdi).getMonth();
    const kisSezonu = ay >= 9 || ay <= 3;
    if (!kisSezonu) return;

    const rotalar = await prisma.winterRoute.findMany({
      where: { aktif: true, oncelik: { in: [1, 2] } },
      orderBy: { oncelik: "asc" },
      select: {
        id: true,
        ad: true,
        oncelik: true,
        operations: {
          orderBy: { baslangic: "desc" },
          take: 1,
          select: { baslangic: true },
        },
      },
    });

    const gecikenler = rotalar.filter((r) => {
      const esikSaat = r.oncelik === 1 ? KIS_ESIK_ONCELIK1_SAAT : KIS_ESIK_ONCELIK2_SAAT;
      const esik = simdi - esikSaat * 60 * 60 * 1000;
      return !r.operations[0] || r.operations[0].baslangic.getTime() < esik;
    });
    if (gecikenler.length === 0) return;

    const otomatik = await otomatikAtamaAcikMi();
    const ilgililer = await kullaniciIdleri(["ADMIN", "DEPARTMENT_MANAGER"]);
    const gun = new Date(simdi).toISOString().slice(0, 10);
    const kullanilanAraclar: string[] = [];

    for (const r of gecikenler) {
      const sonuc = await dispatchOnerisiUret("KIS", r.id, otomatik, kullanilanAraclar);
      if (sonuc) kullanilanAraclar.push(sonuc.vehicleId);
      const esikSaat = r.oncelik === 1 ? KIS_ESIK_ONCELIK1_SAAT : KIS_ESIK_ONCELIK2_SAAT;
      await bildirimGonder(ilgililer, {
        tip: "SLA",
        baslik: `Kış rotası bekliyor: ${r.ad}`,
        mesaj: `Öncelik-${r.oncelik} rota ${esikSaat} saatten uzun süredir işlem görmedi.${
          sonuc ? ` ${sonuc.not}.` : ""
        }`,
        href: "/kis",
        anahtar: `kis:${r.id}:${gun}`,
      });
    }
  } catch (e) {
    console.error("Kış rota taraması başarısız:", e);
  }
}

/** İlk uyarı 09:00; öğleden sonra (14:00+) ikinci tarama penceresi aynı anahtarla spam üretmez */
const COP_UYARI_SAATI = 9;

async function copRotaTaramasi(simdi: number): Promise<void> {
  try {
    const bugun = new Date(simdi);
    if (bugun.getHours() < COP_UYARI_SAATI) return;
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
        collections: {
          orderBy: { baslangic: "desc" },
          take: 1,
          select: { baslangic: true },
        },
      },
    });
    const gecikenler = rotalar.filter((r) => {
      const gunler = (r.gunler as number[]) ?? [];
      if (!gunler.includes(isoGun)) return false;
      const son = r.collections[0]?.baslangic;
      return !son || son < bugunBasi;
    });
    if (gecikenler.length === 0) return;

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
  } catch (e) {
    console.error("Çöp rota taraması başarısız:", e);
  }
}
