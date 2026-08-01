import { prisma } from "@kars/db";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { ARAC_INCLUDE, aracDetay, aracOzet } from "@/lib/api/vehicle-dto";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { aracOlustur } from "@/lib/services/vehicles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async ({ user }) => {
    const url = new URL(req.url);
    const arama = url.searchParams.get("q")?.trim();
    const durum = url.searchParams.get("envanterDurumu")?.trim();
    const p = sayfa(req);

    const where = {
      ...vehicleDepartmentWhere(toAccessUser(user)),
      ...(durum ? { envanterDurumu: durum as never } : {}),
      ...(arama
        ? {
            OR: [
              { plaka: { contains: arama, mode: "insensitive" as const } },
              { ad: { contains: arama, mode: "insensitive" as const } },
              { marka: { contains: arama, mode: "insensitive" as const } },
              { model: { contains: arama, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: ARAC_INCLUDE,
        orderBy: { plaka: "asc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.vehicle.count({ where }),
    ]);

    return ok(sayfali(rows.map(aracOzet), total, p));
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const arac = await aracOlustur(actor, await readJson(req));
    const tam = await prisma.vehicle.findUniqueOrThrow({
      where: { id: arac.id },
      include: ARAC_INCLUDE,
    });
    return created(aracDetay(tam));
  });
}
