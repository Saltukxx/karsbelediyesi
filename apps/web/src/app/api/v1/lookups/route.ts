import { prisma } from "@kars/db";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { ok, panelRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/**
 * Form açılır listeleri. Mobil formlar araç/şoför/personel referanslarına da
 * ihtiyaç duyduğu için tanım tablolarının ötesine geçer.
 */
export async function GET(req: Request) {
  return panelRoute(req, async ({ user }) => {
    const kapsam = departmentWhere(toAccessUser(user));

    const [
      mahalleler,
      mudurlukler,
      sikayetTurleri,
      aracTipleri,
      araclar,
      soforler,
      onaylayanlar,
      personeller,
      betonReceteleri,
      bitumDepolari,
      betonStokKalemleri,
    ] = await Promise.all([
      prisma.neighborhood.findMany({
        where: { aktif: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.department.findMany({
        where: { aktif: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.complaintType.findMany({
        where: { aktif: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.vehicleType.findMany({
        where: { aktif: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.vehicle.findMany({
        where: { envanterDurumu: { not: "HURDAYA_AYRILDI" }, ...kapsam },
        orderBy: { plaka: "asc" },
        select: { id: true, plaka: true, ad: true },
      }),
      prisma.user.findMany({
        where: { aktif: true, role: { in: ["DRIVER", "FIELD_WORKER"] }, ...kapsam },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // Görev / şikayet kapanışında imzalayan; web'de müdürlükle sınırlanmaz
      prisma.user.findMany({
        where: { aktif: true, role: { in: ["APPROVER", "ADMIN"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.personnel.findMany({
        where: { durum: "AKTIF", ...kapsam },
        orderBy: { adSoyad: "asc" },
        select: { id: true, adSoyad: true, unvan: true },
      }),
      prisma.concreteRecipe.findMany({
        where: { aktif: true },
        orderBy: { sinif: "asc" },
        select: { id: true, sinif: true },
      }),
      prisma.bitumDepot.findMany({
        where: { aktif: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, tip: true },
      }),
      prisma.concreteStock.findMany({
        orderBy: { malzeme: "asc" },
        select: { malzeme: true, birim: true },
      }),
    ]);

    return ok({
      mahalleler,
      mudurlukler,
      sikayetTurleri,
      aracTipleri,
      // Geriye dönük uyumluluk: eski istemciler yalnızca cins adlarını okuyor
      aracCinsleri: aracTipleri.map((t) => t.name),
      araclar: araclar.map((v) => ({
        id: v.id,
        plaka: v.plaka,
        ad: v.ad,
        etiket: v.ad ? `${v.plaka} — ${v.ad}` : v.plaka,
      })),
      soforler,
      onaylayanlar,
      personeller: personeller.map((p) => ({
        id: p.id,
        adSoyad: p.adSoyad,
        unvan: p.unvan,
        etiket: p.unvan ? `${p.adSoyad} (${p.unvan})` : p.adSoyad,
      })),
      betonReceteleri,
      bitumDepolari,
      betonStokKalemleri,
    });
  });
}
