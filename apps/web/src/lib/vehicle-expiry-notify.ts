import { prisma } from "@kars/db";
import { trDayKey } from "@/lib/dashboard-range";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

const TARAMA_ARALIGI_MS = 60 * 60 * 1000; // saatte bir
const GUN = 30;
const BATCH = 200;

let sonTarama = 0;

/**
 * 30 gün içinde muayene / sigorta / bakımı dolacak (veya geçmiş) araçlar için
 * admin + ilgili müdürlere UYARI bildirimi üretir.
 * Notification.anahtar ile aynı TR günü tekrar oluşmaz.
 */
export async function aracSuresiTaramasiCalistir(): Promise<void> {
  const simdi = Date.now();
  if (simdi - sonTarama < TARAMA_ARALIGI_MS) return;
  sonTarama = simdi;

  try {
    const in30 = new Date();
    in30.setDate(in30.getDate() + GUN);
    const gunAnahtar = trDayKey(new Date());
    const adminler = await kullaniciIdleri(["ADMIN"]);

    let cursor: string | undefined;
    for (;;) {
      const araclar = await prisma.vehicle.findMany({
        where: {
          envanterDurumu: { not: "HURDAYA_AYRILDI" },
          OR: [
            { muayeneTarihi: { lte: in30 } },
            { sigortaBitis: { lte: in30 } },
            { sonrakiBakimTarihi: { lte: in30 } },
          ],
        },
        select: {
          id: true,
          plaka: true,
          departmentId: true,
          muayeneTarihi: true,
          sigortaBitis: true,
          sonrakiBakimTarihi: true,
        },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (araclar.length === 0) break;
      cursor = araclar[araclar.length - 1]!.id;

      for (const a of araclar) {
        const kalemler: string[] = [];
        if (a.muayeneTarihi && a.muayeneTarihi <= in30) kalemler.push("muayene");
        if (a.sigortaBitis && a.sigortaBitis <= in30) kalemler.push("sigorta");
        if (a.sonrakiBakimTarihi && a.sonrakiBakimTarihi <= in30) {
          kalemler.push("bakım");
        }
        if (kalemler.length === 0) continue;

        const yoneticiler = a.departmentId
          ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], a.departmentId)
          : [];

        await bildirimGonder([...adminler, ...yoneticiler], {
          tip: "UYARI",
          baslik: `Araç süresi: ${a.plaka}`,
          mesaj: `${kalemler.join(", ")} — 30 gün içinde doluyor veya geçmiş.`,
          href: `/araclar?yaklasan=1&ara=${encodeURIComponent(a.plaka)}`,
          anahtar: `arac-sure:${a.id}:${gunAnahtar}`,
        });
      }

      if (araclar.length < BATCH) break;
    }
  } catch (e) {
    console.error("Araç süresi taraması başarısız:", e);
  }
}
