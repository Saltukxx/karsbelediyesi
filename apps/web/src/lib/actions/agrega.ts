"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

function sayi(v: FormDataEntryValue | null, fallback = 0): number {
  const s = v == null ? "" : String(v).trim();
  if (!s) return fallback;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export async function agregaParametreKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.agrega);

  const boyutSatis = [
    {
      boyut: "0-5 mm",
      oran: sayi(formData.get("oran05"), 0.3),
      satisFiyati: sayi(formData.get("satis05"), 180),
      stokHedefi: sayi(formData.get("stok05"), 1000),
    },
    {
      boyut: "5-12 mm",
      oran: sayi(formData.get("oran512"), 0.25),
      satisFiyati: sayi(formData.get("satis512"), 220),
      stokHedefi: sayi(formData.get("stok512"), 1000),
    },
    {
      boyut: "12-19 mm",
      oran: sayi(formData.get("oran1219"), 0.25),
      satisFiyati: sayi(formData.get("satis1219"), 240),
      stokHedefi: sayi(formData.get("stok1219"), 1000),
    },
    {
      boyut: "19-32 mm",
      oran: sayi(formData.get("oran1932"), 0.2),
      satisFiyati: sayi(formData.get("satis1932"), 250),
      stokHedefi: sayi(formData.get("stok1932"), 1000),
    },
  ];

  await prisma.agregaParams.upsert({
    where: { ad: "varsayilan" },
    create: {
      ad: "varsayilan",
      mesafeKm: sayi(formData.get("mesafeKm"), 3),
      motorinFiyat: sayi(formData.get("motorinFiyat"), 45),
      elektrikFiyat: sayi(formData.get("elektrikFiyat"), 3.2),
      sokumYakitLtSaat: sayi(formData.get("sokumYakitLtSaat"), 18),
      sokumAmortisman: sayi(formData.get("sokumAmortisman"), 350),
      sokumKapasiteTonSaat: sayi(formData.get("sokumKapasiteTonSaat"), 45),
      yuklemeYakitLtSaat: sayi(formData.get("yuklemeYakitLtSaat"), 16),
      yuklemeAmortisman: sayi(formData.get("yuklemeAmortisman"), 300),
      yuklemeKapasiteTonSaat: sayi(formData.get("yuklemeKapasiteTonSaat"), 90),
      kamyonKapasiteTon: sayi(formData.get("kamyonKapasiteTon"), 20),
      kamyonYakitLtKm: sayi(formData.get("kamyonYakitLtKm"), 0.42),
      seferHizKmSaat: sayi(formData.get("seferHizKmSaat"), 30),
      yuklemeBosaltmaDk: sayi(formData.get("yuklemeBosaltmaDk"), 10),
      kamyonAmortisman: sayi(formData.get("kamyonAmortisman"), 180),
      kiriciKw: sayi(formData.get("kiriciKw"), 400),
      yukFaktoru: sayi(formData.get("yukFaktoru"), 0.75),
      kiriciKapasiteTonSaat: sayi(formData.get("kiriciKapasiteTonSaat"), 120),
      oran05: sayi(formData.get("oran05"), 0.3),
      oran512: sayi(formData.get("oran512"), 0.25),
      oran1219: sayi(formData.get("oran1219"), 0.25),
      oran1932: sayi(formData.get("oran1932"), 0.2),
      donemUretimTon: sayi(formData.get("donemUretimTon"), 5000),
      gunlukHedefTon: sayi(formData.get("gunlukHedefTon"), 500),
      yillikCalismaGun: sayi(formData.get("yillikCalismaGun"), 250),
      kiriciYakitTon: sayi(formData.get("kiriciYakitTon"), 8.5),
      kiriciBakimTon: sayi(formData.get("kiriciBakimTon"), 3.2),
      yukleyiciYakitTon: sayi(formData.get("yukleyiciYakitTon"), 6.8),
      yukleyiciBakimTon: sayi(formData.get("yukleyiciBakimTon"), 2.5),
      nakliyeYakitTon: sayi(formData.get("nakliyeYakitTon"), 10),
      elekElektrikTon: sayi(formData.get("elekElektrikTon"), 2.5),
      elemeBakimTon: sayi(formData.get("elemeBakimTon"), 6),
      yikamaSuTon: sayi(formData.get("yikamaSuTon"), 1.2),
      genelGiderTon: sayi(formData.get("genelGiderTon"), 0),
      boyutSatis,
    },
    update: {
      mesafeKm: sayi(formData.get("mesafeKm"), 3),
      motorinFiyat: sayi(formData.get("motorinFiyat"), 45),
      elektrikFiyat: sayi(formData.get("elektrikFiyat"), 3.2),
      sokumYakitLtSaat: sayi(formData.get("sokumYakitLtSaat"), 18),
      sokumAmortisman: sayi(formData.get("sokumAmortisman"), 350),
      sokumKapasiteTonSaat: sayi(formData.get("sokumKapasiteTonSaat"), 45),
      yuklemeYakitLtSaat: sayi(formData.get("yuklemeYakitLtSaat"), 16),
      yuklemeAmortisman: sayi(formData.get("yuklemeAmortisman"), 300),
      yuklemeKapasiteTonSaat: sayi(formData.get("yuklemeKapasiteTonSaat"), 90),
      kamyonKapasiteTon: sayi(formData.get("kamyonKapasiteTon"), 20),
      kamyonYakitLtKm: sayi(formData.get("kamyonYakitLtKm"), 0.42),
      seferHizKmSaat: sayi(formData.get("seferHizKmSaat"), 30),
      yuklemeBosaltmaDk: sayi(formData.get("yuklemeBosaltmaDk"), 10),
      kamyonAmortisman: sayi(formData.get("kamyonAmortisman"), 180),
      kiriciKw: sayi(formData.get("kiriciKw"), 400),
      yukFaktoru: sayi(formData.get("yukFaktoru"), 0.75),
      kiriciKapasiteTonSaat: sayi(formData.get("kiriciKapasiteTonSaat"), 120),
      oran05: sayi(formData.get("oran05"), 0.3),
      oran512: sayi(formData.get("oran512"), 0.25),
      oran1219: sayi(formData.get("oran1219"), 0.25),
      oran1932: sayi(formData.get("oran1932"), 0.2),
      donemUretimTon: sayi(formData.get("donemUretimTon"), 5000),
      gunlukHedefTon: sayi(formData.get("gunlukHedefTon"), 500),
      yillikCalismaGun: sayi(formData.get("yillikCalismaGun"), 250),
      kiriciYakitTon: sayi(formData.get("kiriciYakitTon"), 8.5),
      kiriciBakimTon: sayi(formData.get("kiriciBakimTon"), 3.2),
      yukleyiciYakitTon: sayi(formData.get("yukleyiciYakitTon"), 6.8),
      yukleyiciBakimTon: sayi(formData.get("yukleyiciBakimTon"), 2.5),
      nakliyeYakitTon: sayi(formData.get("nakliyeYakitTon"), 10),
      elekElektrikTon: sayi(formData.get("elekElektrikTon"), 2.5),
      elemeBakimTon: sayi(formData.get("elemeBakimTon"), 6),
      yikamaSuTon: sayi(formData.get("yikamaSuTon"), 1.2),
      genelGiderTon: sayi(formData.get("genelGiderTon"), 0),
      boyutSatis,
    },
  });

  await auditKaydet(session, "AGREGA_PARAMETRE_KAYDET", { varlik: "AgregaParams" });

  revalidatePath("/agrega");
}
