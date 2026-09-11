import { prisma } from "@kars/db";
import type { StokHareketTipi } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { stokHareketOlusturForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

/** Son stok hareketleri — isteğe bağlı materialId filtresi. */
export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ACTION_ROLES.materials);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const materialId = url.searchParams.get("materialId")?.trim() || undefined;

  const rows = await prisma.materialMovement.findMany({
    where: materialId ? { materialId } : undefined,
    include: { material: { select: { ad: true, birim: true } } },
    orderBy: { tarih: "desc" },
    take: listLimit(req, 100),
  });

  return json(
    rows.map((r) => ({
      id: r.id,
      materialId: r.materialId,
      malzemeAdi: r.material.ad,
      birim: r.material.birim,
      tip: r.tip,
      miktar: Number(r.miktar),
      aciklama: r.aciklama,
      tarih: r.tarih.toISOString(),
    })),
  );
}

/** Giriş / çıkış — web Server Action `stokHareketOlustur` ile aynı domain. */
export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.materials, async (session, body) => {
    const tipRaw = str(body, "tip").toUpperCase();
    const tip = (tipRaw === "CIKIS" ? "CIKIS" : "GIRIS") as StokHareketTipi;
    const rec = await stokHareketOlusturForUser(session.user, {
      materialId: str(body, "materialId"),
      tip,
      miktar: optNum(body, "miktar") ?? 0,
      aciklama: optStr(body, "aciklama"),
    });
    return {
      id: rec.id,
      materialId: rec.materialId,
      tip: rec.tip,
      miktar: Number(rec.miktar),
    };
  });
}
