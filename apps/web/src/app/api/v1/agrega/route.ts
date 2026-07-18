import { prisma } from "@kars/db";
import { agregaFizikselMaliyet } from "@kars/shared";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "DEPARTMENT_MANAGER"]);
  if (forbidden) return forbidden;

  const params = await prisma.agregaParams.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!params) return json([]);

  const maliyet = agregaFizikselMaliyet({
    mesafeKm: params.mesafeKm,
    motorinFiyat: params.motorinFiyat,
    elektrikFiyat: params.elektrikFiyat,
    sokumYakitLtSaat: params.sokumYakitLtSaat,
    sokumAmortisman: params.sokumAmortisman,
    sokumKapasiteTonSaat: params.sokumKapasiteTonSaat,
    yuklemeYakitLtSaat: params.yuklemeYakitLtSaat,
    yuklemeAmortisman: params.yuklemeAmortisman,
    yuklemeKapasiteTonSaat: params.yuklemeKapasiteTonSaat,
    kamyonKapasiteTon: params.kamyonKapasiteTon,
    kamyonYakitLtKm: params.kamyonYakitLtKm,
    seferHizKmSaat: params.seferHizKmSaat,
    yuklemeBosaltmaDk: params.yuklemeBosaltmaDk,
    kamyonAmortisman: params.kamyonAmortisman,
    kiriciKw: params.kiriciKw,
    yukFaktoru: params.yukFaktoru,
    kiriciKapasiteTonSaat: params.kiriciKapasiteTonSaat,
    oran05: params.oran05,
    oran512: params.oran512,
    oran1219: params.oran1219,
    oran1932: params.oran1932,
    donemUretimTon: params.donemUretimTon,
  });

  return json(
    maliyet.boyutlar.map((b, i) => ({
      id: `${params.id}-${i}`,
      malzeme: b.boyut,
      birimFiyat: b.birimMaliyet,
      miktar: b.tonaj,
      toplam: b.toplamMaliyet,
    })),
  );
}
