import { prisma } from "@kars/db";
import { gercekTuketim, tuketimDurumu } from "@kars/shared";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const [araclar, kayitlar] = await Promise.all([
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      orderBy: { plaka: "asc" },
    }),
    prisma.fuelRecord.findMany(),
  ]);

  const donem = new Date().toISOString().slice(0, 7);

  const rows = araclar.map((a) => {
    const fuel = kayitlar.filter((k) => k.vehicleId === a.id);
    const toplamLitre = fuel.reduce((s, r) => s + Number(r.litre), 0);
    const sayaclar = fuel.map((r) => r.sayac).filter((s): s is number => s != null);
    const sayacFarki =
      sayaclar.length >= 2 ? Math.max(...sayaclar) - Math.min(...sayaclar) : null;
    const tip =
      a.sayacTipi === "SAAT" || a.sayacBirim === "SAAT" ? ("SAAT" as const) : ("KM" as const);
    const gercek = sayacFarki != null ? gercekTuketim(toplamLitre, sayacFarki, tip) : null;
    const norm = a.normTuketim ?? 0;
    const durum = gercek != null && norm > 0 ? tuketimDurumu(gercek, norm) : null;
    const sapma =
      gercek != null && norm > 0 ? ((gercek - norm) / norm) * 100 : null;
    return {
      id: a.id,
      plaka: a.plaka,
      donem,
      ortalamaTuketim: gercek,
      sapmaYuzde: sapma,
      durum,
    };
  });

  return json(rows);
}
