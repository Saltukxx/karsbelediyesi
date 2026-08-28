import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr } from "@/lib/v1-handler";
import { aracOlusturForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "DRIVER",
    "FIELD_WORKER",
  ]);
  if (forbidden) return forbidden;

  const rows = await prisma.vehicle.findMany({
    where: vehicleDepartmentWhere(toAccessUser(auth.user)),
    include: { vehicleType: { select: { name: true } } },
    orderBy: { plaka: "asc" },
    take: listLimit(req),
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

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.vehicles, (session, body) =>
    aracOlusturForUser(session.user, {
      plaka: str(body, "plaka"),
      marka: optStr(body, "marka"),
      model: optStr(body, "model"),
      departmentId: optStr(body, "departmentId"),
      vehicleTypeId: optStr(body, "vehicleTypeId"),
    }),
  );
}
