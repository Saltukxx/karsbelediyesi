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
  const rows = await prisma.fuelRecord.findMany({
    where: Object.keys(dept).length ? { vehicle: dept } : undefined,
    include: { vehicle: { select: { plaka: true } } },
    orderBy: { tarih: "desc" },
    take: 200,
  });

  return json(
    rows.map((r) => ({
      id: r.id,
      plaka: r.vehicle.plaka,
      tarih: r.tarih.toISOString(),
      litre: Number(r.litre),
      tutar: Number(r.tutar),
      istasyon: r.yakitTuru,
    })),
  );
}
