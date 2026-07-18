import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const materials = await prisma.material.findMany({
    where: { aktif: true },
    include: { movements: { select: { tip: true, miktar: true } } },
    orderBy: { ad: "asc" },
  });

  return json(
    materials.map((m) => {
      const stok = m.movements.reduce((s, mv) => {
        const qty = Number(mv.miktar);
        return mv.tip === "GIRIS" ? s + qty : s - qty;
      }, 0);
      return {
        id: m.id,
        malzemeAdi: m.ad,
        birim: m.birim,
        stokMiktari: stok,
        minStok: m.kritikStok,
        depo: m.depoLokasyon,
      };
    }),
  );
}
