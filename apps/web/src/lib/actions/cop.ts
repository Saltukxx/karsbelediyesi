"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  copRotaGuncelle as copRotaGuncelleServis,
  copRotaOlustur,
  copRotaSil as copRotaSilServis,
  copToplamaOlustur,
  copToplamaSil as copToplamaSilServis,
} from "@/lib/services/cop";

function zorunluId(formData: FormData): string {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  return id;
}

/** Gün seçimi yalnız form gönderdiyse güncellenir (aktif toggle'ı göndermez). */
function gunlerVerisi(formData: FormData): Record<string, unknown> {
  const veri = formVerisi(formData);
  if (formData.has("gunler")) {
    veri.gunler = formData.getAll("gunler").map(String);
  } else {
    delete veri.gunler;
  }
  return veri;
}

export async function copRotaKaydet(formData: FormData) {
  const rota = await copRotaOlustur(await requireSession(), gunlerVerisi(formData));
  revalidatePath("/cop");
  return rota.id;
}

export async function copRotaGuncelle(formData: FormData) {
  const id = zorunluId(formData);
  await copRotaGuncelleServis(await requireSession(), id, gunlerVerisi(formData));
  revalidatePath("/cop");
  return id;
}

/** Kullanımdaki rota pasife alınıp hata fırlatılır; liste yine tazelenmeli. */
export async function copRotaSil(formData: FormData) {
  const session = await requireSession();
  try {
    await copRotaSilServis(session, zorunluId(formData));
  } finally {
    revalidatePath("/cop");
  }
}

export async function copToplamaKaydet(formData: FormData) {
  await copToplamaOlustur(await requireSession(), formVerisi(formData));
  revalidatePath("/cop");
}

export async function copToplamaSil(formData: FormData) {
  await copToplamaSilServis(await requireSession(), zorunluId(formData));
  revalidatePath("/cop");
}
