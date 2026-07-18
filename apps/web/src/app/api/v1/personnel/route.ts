import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { departmentWhere, toAccessUser } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.personnel.findMany({
    where: departmentWhere(toAccessUser(auth.user)),
    include: { department: { select: { name: true } } },
    orderBy: { adSoyad: "asc" },
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
