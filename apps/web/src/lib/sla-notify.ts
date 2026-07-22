import { prisma } from "@kars/db";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

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
    if (gecikenler.length === 0) return;

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
  } catch (e) {
    console.error("SLA taraması başarısız:", e);
  }
}
