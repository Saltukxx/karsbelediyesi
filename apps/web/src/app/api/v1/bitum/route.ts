import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.bitumMovement.findMany({
    include: { depo: { select: { ad: true } } },
    orderBy: { tarih: "desc" },
    take: 100,
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
