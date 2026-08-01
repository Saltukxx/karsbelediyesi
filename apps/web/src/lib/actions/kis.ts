"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  kisOperasyonOlustur,
  kisOperasyonSil as kisOperasyonSilServis,
  kisRotaGuncelle as kisRotaGuncelleServis,
  kisRotaOlustur,
  kisRotaSil as kisRotaSilServis,
} from "@/lib/services/kis";

function zorunluId(formData: FormData): string {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  return id;
}

export async function kisRotaKaydet(formData: FormData) {
  const rota = await kisRotaOlustur(await requireSession(), formVerisi(formData));
  revalidatePath("/kis");
  return rota.id;
}

export async function kisRotaGuncelle(formData: FormData) {
  const id = zorunluId(formData);
  await kisRotaGuncelleServis(await requireSession(), id, formVerisi(formData));
  revalidatePath("/kis");
  return id;
}

/** Kullanımdaki rota pasife alınıp hata fırlatılır; liste yine tazelenmeli. */
export async function kisRotaSil(formData: FormData) {
  const session = await requireSession();
  try {
    await kisRotaSilServis(session, zorunluId(formData));
  } finally {
    revalidatePath("/kis");
  }
}

export async function kisOperasyonKaydet(formData: FormData) {
  await kisOperasyonOlustur(await requireSession(), formVerisi(formData));
  revalidatePath("/kis");
  revalidatePath("/malzeme-depo");
}

export async function kisOperasyonSil(formData: FormData) {
  await kisOperasyonSilServis(await requireSession(), zorunluId(formData));
  revalidatePath("/kis");
  revalidatePath("/malzeme-depo");
}
