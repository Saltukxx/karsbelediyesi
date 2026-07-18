import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

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
