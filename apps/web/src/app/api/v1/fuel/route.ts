import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { toAccessUser, vehicleDepartmentWhere } from "@/lib/access";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { yakitOlusturForUser } from "@/lib/domain/crud-for-user";

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
    take: listLimit(req),
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

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.fuel, (session, body) =>
    yakitOlusturForUser(session.user, {
      vehicleId: str(body, "vehicleId"),
      litre: optNum(body, "litre") ?? 0,
      birimFiyat: optNum(body, "birimFiyat") ?? 0,
      sayac: optNum(body, "sayac"),
      yakitTuru: optStr(body, "yakitTuru") as never,
    }),
  );
}
