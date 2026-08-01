import { prisma } from "@kars/db";
import type { AgregaFizikselParams, AgregaProjeParams } from "@kars/shared";

export type BoyutSatis = {
  boyut: string;
  oran: number;
  satisFiyati: number;
  stokHedefi: number;
};

export const AGREGA_PARAMETRE_ADI = "varsayilan";

type AgregaParams = NonNullable<
  Awaited<ReturnType<typeof prisma.agregaParams.findUnique>>
>;

/**
 * `boyutSatis` JSON kolonu; kolon hiç yazılmadıysa oranlar parametrelerden,
 * satış/stok hedefleri Excel varsayılanlarından türetilir.
 */
export function boyutSatisOku(params: AgregaParams): BoyutSatis[] {
  const kayitli = params.boyutSatis as BoyutSatis[] | null;
  return (
    kayitli ?? [
      { boyut: "0-5 mm", oran: params.oran05, satisFiyati: 180, stokHedefi: 1000 },
      { boyut: "5-12 mm", oran: params.oran512, satisFiyati: 220, stokHedefi: 1000 },
      { boyut: "12-19 mm", oran: params.oran1219, satisFiyati: 240, stokHedefi: 1000 },
      { boyut: "19-32 mm", oran: params.oran1932, satisFiyati: 250, stokHedefi: 1000 },
    ]
  );
}

export function fizikselGirdi(params: AgregaParams): AgregaFizikselParams {
  return {
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
  };
}

export function projeGirdi(
  params: AgregaParams,
  boyutlar: BoyutSatis[],
): AgregaProjeParams {
  return {
    gunlukHedefTon: params.gunlukHedefTon,
    kiriciYakitTon: params.kiriciYakitTon,
    kiriciBakimTon: params.kiriciBakimTon,
    yukleyiciYakitTon: params.yukleyiciYakitTon,
    yukleyiciBakimTon: params.yukleyiciBakimTon,
    nakliyeYakitTon: params.nakliyeYakitTon,
    elekElektrikTon: params.elekElektrikTon,
    elemeBakimTon: params.elemeBakimTon,
    yikamaSuTon: params.yikamaSuTon,
    genelGiderTon: params.genelGiderTon,
    boyutlar,
  };
}

export async function agregaVerisi(): Promise<{
  params: AgregaParams | null;
  boyutSatis: BoyutSatis[];
  fiziksel: AgregaFizikselParams | null;
  proje: AgregaProjeParams | null;
}> {
  const params = await prisma.agregaParams.findUnique({
    where: { ad: AGREGA_PARAMETRE_ADI },
  });
  if (!params) {
    return { params: null, boyutSatis: [], fiziksel: null, proje: null };
  }
  const boyutSatis = boyutSatisOku(params);
  return {
    params,
    boyutSatis,
    fiziksel: fizikselGirdi(params),
    proje: projeGirdi(params, boyutSatis),
  };
}
