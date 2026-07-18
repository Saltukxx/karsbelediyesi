import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.vehicle.findMany({
    where: vehicleDepartmentWhere(toAccessUser(auth.user)),
    include: { vehicleType: { select: { name: true } } },
    orderBy: { plaka: "asc" },
  });

  return json(
    rows.map((v) => ({
      id: v.id,
      plaka: v.plaka,
      marka: v.marka,
      model: v.model,
      cins: v.vehicleType?.name ?? null,
      envanterDurumu: v.envanterDurumu,
      operasyonDurumu: v.operasyonDurumu,
      sayacDeger: v.sayacDeger,
      atananSoforId: v.atananSoforId,
    })),
  );
}
