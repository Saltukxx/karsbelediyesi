import { BitumHareketTipi, prisma } from "@kars/db";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { iso } from "@/lib/api/serialize";
import { BITUM_HAREKET_INCLUDE, bitumHareketDto } from "@/lib/api/bitum-dto";
import { ok, panelRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/** `/bitum` sayfası: ayarlar, depo doluluk durumları ve hareket geçmişi. */
export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const url = new URL(req.url);
    const tip = url.searchParams.get("tip")?.trim();
    const p = sayfa(req);

    const where = tip ? { tip: tip as BitumHareketTipi } : {};

    const [settings, depolar, rows, total, tumHareketler] = await Promise.all([
      prisma.bitumSettings.findUnique({ where: { id: "default" } }),
      prisma.bitumDepot.findMany({ where: { aktif: true }, orderBy: { ad: "asc" } }),
      prisma.bitumMovement.findMany({
        where,
        include: BITUM_HAREKET_INCLUDE,
        orderBy: { tarih: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.bitumMovement.count({ where }),
      prisma.bitumMovement.findMany({
        select: {
          tip: true,
          miktarTon: true,
          depoId: true,
          hedefDepoId: true,
          kaynakDepoId: true,
          kullanimDepoId: true,
        },
      }),
    ]);

    return ok({
      ayarlar: settings
        ? {
            depoKapasitesiTon: settings.depoKapasitesiTon,
            mesafeKm: settings.mesafeKm,
            tirKapasiteTon: settings.tirKapasiteTon,
            yakitTlKm: settings.yakitTlKm,
            seferMaliyetiTl: settings.seferMaliyetiTl,
            tonTasimaTl: settings.tonTasimaTl,
            referansAlisFiyat: settings.referansAlisFiyat,
            kritikEsik: settings.kritikEsik,
            dusukEsik: settings.dusukEsik,
            updatedAt: iso(settings.updatedAt),
          }
        : null,
      depolar: depolar.map((d) => {
        const stok = depoStogu(tumHareketler, d.id);
        const doluluk = d.kapasite > 0 ? stok / d.kapasite : 0;
        return {
          id: d.id,
          ad: d.ad,
          tip: d.tip,
          kapasite: d.kapasite,
          stokTon: stok,
          dolulukOrani: doluluk,
          durum: dolulukDurumu(doluluk, settings),
        };
      }),
      ...sayfali(rows.map(bitumHareketDto), total, p),
    });
  });
}

type HareketOzeti = {
  tip: BitumHareketTipi;
  miktarTon: number;
  depoId: string | null;
  hedefDepoId: string | null;
  kaynakDepoId: string | null;
  kullanimDepoId: string | null;
};

/** Depo stoğu: alış + gelen taşıma − giden taşıma − kullanım. */
function depoStogu(hareketler: HareketOzeti[], depoId: string): number {
  return hareketler.reduce((s, h) => {
    if (h.tip === BitumHareketTipi.ALIS && h.depoId === depoId) return s + h.miktarTon;
    if (h.tip === BitumHareketTipi.TASIMA) {
      if (h.hedefDepoId === depoId) return s + h.miktarTon;
      if (h.kaynakDepoId === depoId) return s - h.miktarTon;
    }
    if (h.tip === BitumHareketTipi.KULLANIM && h.kullanimDepoId === depoId) {
      return s - h.miktarTon;
    }
    return s;
  }, 0);
}

function dolulukDurumu(
  oran: number,
  settings: { kritikEsik: number; dusukEsik: number } | null,
): "KRITIK" | "DUSUK" | "NORMAL" {
  const kritik = settings?.kritikEsik ?? 0.2;
  const dusuk = settings?.dusukEsik ?? 0.4;
  if (oran <= kritik) return "KRITIK";
  if (oran <= dusuk) return "DUSUK";
  return "NORMAL";
}
