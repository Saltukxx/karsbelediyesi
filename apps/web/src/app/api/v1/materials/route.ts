import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { malzemeOlusturForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  // Stok = giriş − çıkış. Her malzemenin tüm hareketlerini çekip JS'te toplamak
  // hareket tablosu büyüdükçe yanıtı da büyütüyordu; toplamı veritabanı yapıyor.
  const [materials, toplamlar] = await Promise.all([
    prisma.material.findMany({
      where: { aktif: true },
      orderBy: { ad: "asc" },
      take: listLimit(req),
    }),
    prisma.materialMovement.groupBy({
      by: ["materialId", "tip"],
      _sum: { miktar: true },
    }),
  ]);

  const stoklar = new Map<string, number>();
  for (const satir of toplamlar) {
    const miktar = Number(satir._sum.miktar ?? 0);
    const onceki = stoklar.get(satir.materialId) ?? 0;
    stoklar.set(satir.materialId, satir.tip === "GIRIS" ? onceki + miktar : onceki - miktar);
  }

  return json(
    materials.map((m) => {
      const stok = stoklar.get(m.id) ?? 0;
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

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.materials, (session, body) =>
    malzemeOlusturForUser(session.user, {
      kod: str(body, "kod"),
      ad: str(body, "ad"),
      kategori: str(body, "kategori") || "GENEL",
      birim: str(body, "birim") || "ADET",
      depoLokasyon: optStr(body, "depoLokasyon"),
      kritikStok: optNum(body, "kritikStok"),
    }),
  );
}
