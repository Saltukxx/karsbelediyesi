"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import { betonUretimMalzeme } from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

export async function betonUretimOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.concrete);

  const recipeId = String(formData.get("recipeId"));
  const hedefM3 = sayi(formData.get("hedefM3")) ?? 0;
  const recipe = await prisma.concreteRecipe.findUniqueOrThrow({ where: { id: recipeId } });

  const cimentoKg = betonUretimMalzeme(hedefM3, recipe.cimentoKg);
  const kumKg = betonUretimMalzeme(hedefM3, recipe.kumKg);
  const micir05Kg = betonUretimMalzeme(hedefM3, recipe.micir05Kg);
  const micir512Kg = betonUretimMalzeme(hedefM3, recipe.micir512Kg);
  const micir1219Kg = betonUretimMalzeme(hedefM3, recipe.micir1219Kg);
  const suLt = betonUretimMalzeme(hedefM3, recipe.suLt);
  const katkiKg = betonUretimMalzeme(hedefM3, recipe.katkiKg);

  await prisma.concreteProduction.create({
    data: {
      tarih: new Date(String(formData.get("tarih"))),
      recipeId,
      hedefM3,
      cimentoKg,
      kumKg,
      micir05Kg,
      micir512Kg,
      micir1219Kg,
      suLt,
      katkiKg,
      notlar: bos(formData.get("notlar")),
    },
  });

  await auditKaydet(session, "BETON_URETIM_OLUSTUR", {
    varlik: "ConcreteProduction",
    detay: { recipeId, hedefM3 },
  });

  // Stok çıkışı production aggregate ile sayfada hesaplanır; burada sadece kayıt.
  revalidatePath("/beton");
}

export async function betonStokGiris(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.concrete);
  const malzeme = String(formData.get("malzeme"));
  const miktar = sayi(formData.get("miktar")) ?? 0;
  await prisma.concreteStock.update({
    where: { malzeme },
    data: { toplamGiris: { increment: miktar } },
  });
  await auditKaydet(session, "BETON_STOK_GIRIS", {
    varlik: "ConcreteStock",
    detay: { malzeme, miktar },
  });
  revalidatePath("/beton");
}

export async function betonReceteGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.concrete);
  const id = String(formData.get("id"));
  await prisma.concreteRecipe.update({
    where: { id },
    data: {
      cimentoKg: sayi(formData.get("cimentoKg")) ?? 0,
      kumKg: sayi(formData.get("kumKg")) ?? 0,
      micir05Kg: sayi(formData.get("micir05Kg")) ?? 0,
      micir512Kg: sayi(formData.get("micir512Kg")) ?? 0,
      micir1219Kg: sayi(formData.get("micir1219Kg")) ?? 0,
      suLt: sayi(formData.get("suLt")) ?? 0,
      katkiKg: sayi(formData.get("katkiKg")) ?? 0,
      aciklama: bos(formData.get("aciklama")),
    },
  });
  await auditKaydet(session, "BETON_RECETE_GUNCELLE", {
    varlik: "ConcreteRecipe",
    varlikId: id,
  });
  revalidatePath("/beton");
}
