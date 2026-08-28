import { prisma } from "@kars/db";
import { gercekTuketim, tuketimDurumu } from "@kars/shared";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  // Tüm yakıt tablosunu çekip araç başına filtrelemek hem tabloyu belleğe alıyor
  // hem araç×kayıt kadar dönüyordu; litre toplamı ile sayaç uçları tek grup sorgusu.
  const [araclar, ozetler] = await Promise.all([
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      orderBy: { plaka: "asc" },
      take: listLimit(req),
    }),
    prisma.fuelRecord.groupBy({
      by: ["vehicleId"],
      _sum: { litre: true },
      _min: { sayac: true },
      _max: { sayac: true },
      _count: { sayac: true },
    }),
  ]);

  const ozetByVehicle = new Map(ozetler.map((o) => [o.vehicleId, o]));
  const donem = new Date().toISOString().slice(0, 7);

  const rows = araclar.map((a) => {
    const ozet = ozetByVehicle.get(a.id);
    const toplamLitre = Number(ozet?._sum.litre ?? 0);
    // Sayaç farkı en az iki okuma ister; _count.sayac null olmayanları sayar.
    const sayacFarki =
      ozet && ozet._count.sayac >= 2 && ozet._max.sayac != null && ozet._min.sayac != null
        ? ozet._max.sayac - ozet._min.sayac
        : null;
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
