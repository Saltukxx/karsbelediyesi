import { z } from "zod";
import { prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import { bosIse, rolGerekli, sayiAlani, type ServiceActor } from "@/lib/services/base";

/** Alan gönderilmez ya da boş bırakılırsa web formundaki varsayılan uygulanır */
function parametre(varsayilan: number) {
  return bosIse(sayiAlani(z.number()).default(varsayilan));
}

/** Kolon olarak yazılan model parametreleri */
const kolonSchema = z.object({
  mesafeKm: parametre(3),
  motorinFiyat: parametre(45),
  elektrikFiyat: parametre(3.2),
  sokumYakitLtSaat: parametre(18),
  sokumAmortisman: parametre(350),
  sokumKapasiteTonSaat: parametre(45),
  yuklemeYakitLtSaat: parametre(16),
  yuklemeAmortisman: parametre(300),
  yuklemeKapasiteTonSaat: parametre(90),
  kamyonKapasiteTon: parametre(20),
  kamyonYakitLtKm: parametre(0.42),
  seferHizKmSaat: parametre(30),
  yuklemeBosaltmaDk: parametre(10),
  kamyonAmortisman: parametre(180),
  kiriciKw: parametre(400),
  yukFaktoru: parametre(0.75),
  kiriciKapasiteTonSaat: parametre(120),
  oran05: parametre(0.3),
  oran512: parametre(0.25),
  oran1219: parametre(0.25),
  oran1932: parametre(0.2),
  donemUretimTon: parametre(5000),
  gunlukHedefTon: parametre(500),
  yillikCalismaGun: parametre(250),
  kiriciYakitTon: parametre(8.5),
  kiriciBakimTon: parametre(3.2),
  yukleyiciYakitTon: parametre(6.8),
  yukleyiciBakimTon: parametre(2.5),
  nakliyeYakitTon: parametre(10),
  elekElektrikTon: parametre(2.5),
  elemeBakimTon: parametre(6),
  yikamaSuTon: parametre(1.2),
  genelGiderTon: parametre(0),
});

/** `boyutSatis` JSON kolonuna dönüşen satış/stok hedefleri */
const boyutSchema = z.object({
  satis05: parametre(180),
  satis512: parametre(220),
  satis1219: parametre(240),
  satis1932: parametre(250),
  stok05: parametre(1000),
  stok512: parametre(1000),
  stok1219: parametre(1000),
  stok1932: parametre(1000),
});

export const agregaParametreInputSchema = kolonSchema.merge(boyutSchema);

export type AgregaParametreInput = z.input<typeof agregaParametreInputSchema>;

const PARAMETRE_ADI = "varsayilan";

export async function agregaParametreKaydet(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.agrega);
  const kolonlar = kolonSchema.parse(input);
  const b = boyutSchema.parse(input);

  // Boyut bazlı satış/stok hedefleri JSON kolonunda tutulur
  const boyutSatis = [
    {
      boyut: "0-5 mm",
      oran: kolonlar.oran05,
      satisFiyati: b.satis05,
      stokHedefi: b.stok05,
    },
    {
      boyut: "5-12 mm",
      oran: kolonlar.oran512,
      satisFiyati: b.satis512,
      stokHedefi: b.stok512,
    },
    {
      boyut: "12-19 mm",
      oran: kolonlar.oran1219,
      satisFiyati: b.satis1219,
      stokHedefi: b.stok1219,
    },
    {
      boyut: "19-32 mm",
      oran: kolonlar.oran1932,
      satisFiyati: b.satis1932,
      stokHedefi: b.stok1932,
    },
  ];

  const params = await prisma.agregaParams.upsert({
    where: { ad: PARAMETRE_ADI },
    create: { ad: PARAMETRE_ADI, ...kolonlar, boyutSatis },
    update: { ...kolonlar, boyutSatis },
  });

  await auditKaydet(actor, "AGREGA_PARAMETRE_KAYDET", {
    varlik: "AgregaParams",
    varlikId: params.id,
  });
  return params;
}
