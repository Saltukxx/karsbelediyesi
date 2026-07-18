import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const dept = vehicleDepartmentWhere(toAccessUser(auth.user));
  const rows = await prisma.maintenanceRecord.findMany({
    where: Object.keys(dept).length ? { vehicle: dept } : undefined,
    include: { vehicle: { select: { plaka: true } } },
    orderBy: { bakimTarihi: "desc" },
    take: 200,
  });

  return json(
    rows.map((r) => ({
      id: r.id,
      plaka: r.vehicle.plaka,
      bakimTipi: r.bakimTuru,
      tarih: r.bakimTarihi.toISOString(),
      maliyet: r.maliyet != null ? Number(r.maliyet) : null,
      aciklama: r.yapilanIslemler,
    })),
  );
}
