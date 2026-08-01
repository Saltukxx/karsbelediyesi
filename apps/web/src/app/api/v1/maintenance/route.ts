import { prisma } from "@kars/db";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { gun, iso, num } from "@/lib/api/serialize";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { bakimOlustur } from "@/lib/services/vehicles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async ({ user }) => {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId")?.trim();
    const durum = url.searchParams.get("durum")?.trim();
    const p = sayfa(req);

    const dept = vehicleDepartmentWhere(toAccessUser(user));
    const where = {
      ...(Object.keys(dept).length ? { vehicle: dept } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(durum ? { durum: durum as never } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.maintenanceRecord.findMany({
        where,
        include: { vehicle: { select: { plaka: true, ad: true } } },
        orderBy: { bakimTarihi: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.maintenanceRecord.count({ where }),
    ]);

    return ok(
      sayfali(
        rows.map((r) => ({
          id: r.id,
          vehicleId: r.vehicleId,
          plaka: r.vehicle.plaka,
          aracAdi: r.vehicle.ad,
          bakimTarihi: gun(r.bakimTarihi),
          bakimTuru: r.bakimTuru,
          durum: r.durum,
          yapilanIslemler: r.yapilanIslemler,
          kullanilanMalzeme: r.kullanilanMalzeme,
          maliyet: num(r.maliyet),
          yapanFirmaPersonel: r.yapanFirmaPersonel,
          sonrakiBakimTarihi: gun(r.sonrakiBakimTarihi),
          // Kontrol formundaki arızalı kalemden otomatik açıldıysa işaretlenir
          otomatikOlusturuldu: r.kaynakChecklistItemResultId != null,
          createdAt: iso(r.createdAt),
        })),
        total,
        p,
      ),
    );
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const kayit = await bakimOlustur(actor, await readJson(req));
    return created({
      id: kayit.id,
      vehicleId: kayit.vehicleId,
      bakimTarihi: gun(kayit.bakimTarihi),
      bakimTuru: kayit.bakimTuru,
      durum: kayit.durum,
      maliyet: num(kayit.maliyet),
    });
  });
}
