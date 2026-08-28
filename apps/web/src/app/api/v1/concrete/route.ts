import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { betonUretimForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const recipes = await prisma.concreteRecipe.findMany({
    where: { aktif: true },
    orderBy: { sinif: "asc" },
  });

  return json(
    recipes.map((r) => ({
      id: r.id,
      receteAdi: r.sinif,
      sinif: r.sinif,
      guncelStok: null as number | null,
      durum: r.aktif ? "AKTIF" : "PASIF",
    })),
  );
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.concrete, (session, body) =>
    betonUretimForUser(session.user, {
      recipeId: str(body, "recipeId"),
      hedefM3: optNum(body, "hedefM3") ?? 0,
      tarih: optStr(body, "tarih"),
      notlar: optStr(body, "notlar"),
    }),
  );
}
