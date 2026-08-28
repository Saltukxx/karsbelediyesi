import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { bitumHareketForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.bitumMovement.findMany({
    include: { depo: { select: { ad: true } } },
    orderBy: { tarih: "desc" },
    take: listLimit(req, 100),
  });

  return json(
    rows.map((r) => ({
      id: r.id,
      tarih: r.tarih.toISOString(),
      miktar: r.miktarTon,
      proje: r.depo?.ad ?? r.tip,
      aciklama: r.aciklama ?? r.tip,
    })),
  );
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.bitum, (session, body) =>
    bitumHareketForUser(session.user, {
      depoId: str(body, "depoId"),
      miktarTon: optNum(body, "miktarTon") ?? 0,
      tip: (optStr(body, "tip") as "ALIS" | "KULLANIM") ?? "ALIS",
      aciklama: optStr(body, "aciklama"),
    }),
  );
}
