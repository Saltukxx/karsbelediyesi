"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { betonUretimForUser } from "@/lib/domain/crud-for-user";

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
  await betonUretimForUser(session.user, {
    recipeId: String(formData.get("recipeId")),
    hedefM3: sayi(formData.get("hedefM3")) ?? 0,
    tarih: bos(formData.get("tarih")),
    notlar: bos(formData.get("notlar")),
  });
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
