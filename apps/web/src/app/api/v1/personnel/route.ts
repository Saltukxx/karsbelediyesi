import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { personelOlusturForUser, personelGuncelleForUser, personelPasifeAlForUser } from "@/lib/domain/personnel";

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

  const rows = await prisma.personnel.findMany({
    where: departmentWhere(toAccessUser(auth.user)),
    include: { department: { select: { name: true } } },
    orderBy: { adSoyad: "asc" },
    take: listLimit(req),
  });

  return json(
    rows.map((p) => ({
      id: p.id,
      adSoyad: p.adSoyad,
      unvan: p.unvan,
      mudurluk: p.department?.name ?? null,
      durum: p.durum,
    })),
  );
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.personnel, (session, body) =>
    personelOlusturForUser(session, {
      adSoyad: str(body, "adSoyad"),
      unvan: optStr(body, "unvan"),
      departmentId: optStr(body, "departmentId"),
      telefon: optStr(body, "telefon"),
      durum: (optStr(body, "durum") as never) ?? "AKTIF",
      saatUcret: optNum(body, "saatUcret"),
    }),
  );
}

export async function PATCH(req: Request) {
  return handleV1Write(req, ACTION_ROLES.personnel, (session, body) => {
    if (str(body, "action") === "deactivate") {
      return personelPasifeAlForUser(session, str(body, "id"));
    }
    return personelGuncelleForUser(session, {
      id: str(body, "id"),
      adSoyad: str(body, "adSoyad"),
      unvan: optStr(body, "unvan"),
      departmentId: optStr(body, "departmentId"),
      telefon: optStr(body, "telefon"),
    });
  });
}
