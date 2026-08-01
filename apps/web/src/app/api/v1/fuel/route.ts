import { prisma } from "@kars/db";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { gun, num } from "@/lib/api/serialize";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { yakitOlustur } from "@/lib/services/vehicles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async ({ user }) => {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId")?.trim();
    const baslangic = url.searchParams.get("baslangic")?.trim();
    const bitis = url.searchParams.get("bitis")?.trim();
    const p = sayfa(req);

    const dept = vehicleDepartmentWhere(toAccessUser(user));
    const where = {
      ...(Object.keys(dept).length ? { vehicle: dept } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(baslangic || bitis
        ? {
            tarih: {
              ...(baslangic ? { gte: new Date(baslangic) } : {}),
              ...(bitis ? { lte: new Date(bitis) } : {}),
            },
          }
        : {}),
    };

    const [rows, total, toplam] = await Promise.all([
      prisma.fuelRecord.findMany({
        where,
        include: {
          vehicle: { select: { plaka: true, ad: true } },
          sorumluPersonel: { select: { id: true, adSoyad: true } },
        },
        orderBy: { tarih: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.fuelRecord.count({ where }),
      prisma.fuelRecord.aggregate({ where, _sum: { litre: true, tutar: true } }),
    ]);

    return ok({
      ...sayfali(
        rows.map((r) => ({
          id: r.id,
          vehicleId: r.vehicleId,
          plaka: r.vehicle.plaka,
          aracAdi: r.vehicle.ad,
          tarih: gun(r.tarih),
          yakitTuru: r.yakitTuru,
          litre: num(r.litre),
          birimFiyat: num(r.birimFiyat),
          tutar: num(r.tutar),
          sayac: num(r.sayac),
          sorumluPersonelId: r.sorumluPersonelId,
          sorumluPersonelAdi: r.sorumluPersonel?.adSoyad ?? null,
          vehicleTaskId: r.vehicleTaskId,
          // Günlük çalışma kaydından türetilen satırlar elle düzenlenmez
          gunlukCalismadan: r.vehicleWorkLogId != null,
        })),
        total,
        p,
      ),
      ozet: {
        toplamLitre: num(toplam._sum.litre) ?? 0,
        toplamTutar: num(toplam._sum.tutar) ?? 0,
      },
    });
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const kayit = await yakitOlustur(actor, await readJson(req));
    return created({
      id: kayit.id,
      vehicleId: kayit.vehicleId,
      tarih: gun(kayit.tarih),
      yakitTuru: kayit.yakitTuru,
      litre: num(kayit.litre),
      birimFiyat: num(kayit.birimFiyat),
      tutar: num(kayit.tutar),
    });
  });
}
