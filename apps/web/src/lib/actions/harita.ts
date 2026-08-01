"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import {
  asfaltPersonelAta as asfaltPersonelAtaServis,
  asfaltYolGuncelle as asfaltYolGuncelleServis,
  asfaltYolOlustur,
  asfaltYolSil as asfaltYolSilServis,
  engelDurumGuncelle as engelDurumGuncelleServis,
  engelOlustur,
  engelSil as engelSilServis,
} from "@/lib/services/harita";
import { formVerisi } from "@/lib/services/base";

function zorunluId(formData: FormData): string {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  return id;
}

export async function asfaltYolKaydet(formData: FormData) {
  await asfaltYolOlustur(await requireSession(), formVerisi(formData));
  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltYolGuncelle(formData: FormData) {
  await asfaltYolGuncelleServis(await requireSession(), zorunluId(formData), formVerisi(formData));
  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltPersonelAta(formData: FormData) {
  await asfaltPersonelAtaServis(await requireSession(), zorunluId(formData), {
    personnelIds: formData.getAll("personnelIds").map(String).filter(Boolean),
  });
  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltYolSil(formData: FormData) {
  await asfaltYolSilServis(await requireSession(), zorunluId(formData));
  revalidatePath("/harita");
}

export async function engelKaydet(formData: FormData) {
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  await engelOlustur(await requireSession(), formVerisi(formData), photos);
  revalidatePath("/harita");
}

export async function engelDurumGuncelle(formData: FormData) {
  await engelDurumGuncelleServis(await requireSession(), zorunluId(formData), {
    durum: String(formData.get("durum") ?? ""),
  });
  revalidatePath("/harita");
}

export async function engelSil(formData: FormData) {
  await engelSilServis(await requireSession(), zorunluId(formData));
  revalidatePath("/harita");
}
