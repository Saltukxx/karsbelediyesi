import { prisma } from "@kars/db";
import { assertVehicleApiAccess, toAccessUser } from "@/lib/access";
import { gun, num } from "@/lib/api/serialize";
import { ARAC_INCLUDE, aracDetay } from "@/lib/api/vehicle-dto";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { aracGuncelle } from "@/lib/services/vehicles";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Araç kartı: `/araclar/[id]` sayfasının gösterdiği tüm bölümler. */
export async function GET(req: Request, { params }: Params) {
  return panelRoute(req, async ({ user }) => {
    const { id } = await params;
    const erisim = await assertVehicleApiAccess(toAccessUser(user), id);
    if (erisim instanceof Response) return erisim;

    const [arac, bakimlar, yakitlar, gorevler, gunlukler] = await Promise.all([
      prisma.vehicle.findUniqueOrThrow({ where: { id }, include: ARAC_INCLUDE }),
      prisma.maintenanceRecord.findMany({
        where: { vehicleId: id },
        orderBy: { bakimTarihi: "desc" },
        take: 50,
      }),
      prisma.fuelRecord.findMany({
        where: { vehicleId: id },
        orderBy: { tarih: "desc" },
        take: 50,
      }),
      prisma.vehicleTask.findMany({
        where: { vehicleId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          gorevNo: true,
          gorevTanimi: true,
          durum: true,
          talepTarihi: true,
          cikisTarihi: true,
        },
      }),
      prisma.vehicleWorkLog.findMany({
        where: { vehicleId: id },
        orderBy: { tarih: "desc" },
        take: 30,
        select: {
          id: true,
          tarih: true,
          girisSaati: true,
          cikisSaati: true,
          calismaSaati: true,
          soforAdi: true,
        },
      }),
    ]);

    return ok({
      arac: aracDetay(arac),
      bakimlar: bakimlar.map((b) => ({
        id: b.id,
        bakimTarihi: gun(b.bakimTarihi),
        bakimTuru: b.bakimTuru,
        durum: b.durum,
        maliyet: num(b.maliyet),
        yapilanIslemler: b.yapilanIslemler,
      })),
      yakitlar: yakitlar.map((y) => ({
        id: y.id,
        tarih: gun(y.tarih),
        yakitTuru: y.yakitTuru,
        litre: num(y.litre),
        birimFiyat: num(y.birimFiyat),
        tutar: num(y.tutar),
        sayac: num(y.sayac),
      })),
      gorevler: gorevler.map((g) => ({
        id: g.id,
        gorevNo: g.gorevNo,
        gorevTanimi: g.gorevTanimi,
        durum: g.durum,
        talepTarihi: gun(g.talepTarihi),
        cikisTarihi: gun(g.cikisTarihi),
      })),
      gunlukCalismalar: gunlukler.map((g) => ({
        id: g.id,
        tarih: gun(g.tarih),
        girisSaati: g.girisSaati,
        cikisSaati: g.cikisSaati,
        calismaSaati: g.calismaSaati,
        soforAdi: g.soforAdi,
      })),
    });
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return panelRoute(req, async (actor) => {
    const { id } = await params;
    await aracGuncelle(actor, id, await readJson(req));
    const tam = await prisma.vehicle.findUniqueOrThrow({
      where: { id },
      include: ARAC_INCLUDE,
    });
    return ok(aracDetay(tam));
  });
}
