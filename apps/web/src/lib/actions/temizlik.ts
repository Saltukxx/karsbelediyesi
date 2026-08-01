"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  temizlikRotaGuncelle as temizlikRotaGuncelleServis,
  temizlikRotaOlustur,
  temizlikRotaSil as temizlikRotaSilServis,
} from "@/lib/services/temizlik";

function zorunluId(formData: FormData): string {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  return id;
}

export async function temizlikRotaKaydet(formData: FormData) {
  const rota = await temizlikRotaOlustur(await requireSession(), formVerisi(formData));
  revalidatePath("/temizlik");
  return rota.id;
}

export async function temizlikRotaGuncelle(formData: FormData) {
  const id = zorunluId(formData);
  await temizlikRotaGuncelleServis(await requireSession(), id, formVerisi(formData));
  revalidatePath("/temizlik");
  return id;
}

/** Kullanımdaki rota pasife alınıp hata fırlatılır; liste yine tazelenmeli. */
export async function temizlikRotaSil(formData: FormData) {
  const session = await requireSession();
  try {
    await temizlikRotaSilServis(session, zorunluId(formData));
  } finally {
    revalidatePath("/temizlik");
  }
}
