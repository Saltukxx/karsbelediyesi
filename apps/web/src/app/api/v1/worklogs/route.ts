import { prisma } from "@kars/db";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { gun, num } from "@/lib/api/serialize";
import { ok, panelRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/**
 * `/gunluk-calisma` sayfası iki ayrı defter gösterir (personel mesaisi ve araç
 * çalışması). Tek listede birleştirmek yerine iki koleksiyon döner; mobil taraf
 * sekmeleri ayrı besler.
 */
export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const url = new URL(req.url);
    const baslangic = url.searchParams.get("baslangic")?.trim();
    const bitis = url.searchParams.get("bitis")?.trim();
    const personnelId = url.searchParams.get("personnelId")?.trim();
    const vehicleId = url.searchParams.get("vehicleId")?.trim();
    const p = sayfa(req);

    const tarihFiltresi =
      baslangic || bitis
        ? {
            tarih: {
              ...(baslangic ? { gte: new Date(baslangic) } : {}),
              ...(bitis ? { lte: new Date(bitis) } : {}),
            },
          }
        : {};

    const personelWhere = {
      ...tarihFiltresi,
      ...(personnelId ? { personnelId } : {}),
    };
    const aracWhere = {
      ...tarihFiltresi,
      ...(vehicleId ? { vehicleId } : {}),
    };

    const [personel, personelTotal, arac, aracTotal] = await Promise.all([
      prisma.personnelWorkLog.findMany({
        where: personelWhere,
        include: {
          personnel: { select: { id: true, adSoyad: true, unvan: true } },
          gorevlendirilenBirim: { select: { name: true } },
          onaylayan: { select: { name: true } },
        },
        orderBy: { tarih: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.personnelWorkLog.count({ where: personelWhere }),
      prisma.vehicleWorkLog.findMany({
        where: aracWhere,
        include: {
          vehicle: { select: { id: true, plaka: true, ad: true } },
          driver: { select: { id: true, name: true } },
          onaylayan: { select: { name: true } },
          fuelRecord: { select: { id: true, litre: true, tutar: true } },
        },
        orderBy: { tarih: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.vehicleWorkLog.count({ where: aracWhere }),
    ]);

    return ok({
      personelMesaileri: sayfali(
        personel.map((r) => ({
          id: r.id,
          personnelId: r.personnelId,
          personelAdi: r.personnel.adSoyad,
          unvan: r.personnel.unvan,
          tarih: gun(r.tarih),
          girisSaati: r.girisSaati,
          cikisSaati: r.cikisSaati,
          normalSaat: r.normalSaat,
          mesaiSaat: r.mesaiSaat,
          toplamSaat: r.toplamSaat,
          calismaTipi: r.calismaTipi,
          yapilanIs: r.yapilanIs,
          gorevlendirilenBirimId: r.gorevlendirilenBirimId,
          gorevlendirilenBirim: r.gorevlendirilenBirim?.name ?? null,
          notlar: r.notlar,
          onaylayan: r.onaylayan?.name ?? null,
        })),
        personelTotal,
        p,
      ),
      aracCalismalari: sayfali(
        arac.map((r) => ({
          id: r.id,
          vehicleId: r.vehicleId,
          plaka: r.vehicle.plaka,
          aracAdi: r.vehicle.ad,
          tarih: gun(r.tarih),
          driverId: r.driverId,
          soforAdi: r.driver?.name ?? r.soforAdi,
          gorevTanimi: r.gorevTanimi,
          yerBolge: r.yerBolge,
          girisSaati: r.girisSaati,
          cikisSaati: r.cikisSaati,
          calismaSaati: r.calismaSaati,
          yakitLitre: num(r.yakitLitre),
          yakitTutari: num(r.fuelRecord?.tutar),
          notlar: r.notlar,
          onaylayan: r.onaylayan?.name ?? null,
        })),
        aracTotal,
        p,
      ),
    });
  });
}
