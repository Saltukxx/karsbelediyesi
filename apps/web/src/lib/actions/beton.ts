"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  betonReceteGuncelle as betonReceteGuncelleService,
  betonStokGiris as betonStokGirisService,
  betonUretimOlustur as betonUretimOlusturService,
} from "@/lib/services/concrete";

export async function betonUretimOlustur(formData: FormData) {
  const session = await requireSession();
  await betonUretimOlusturService(session, formVerisi(formData));
  // Stok çıkışı üretim toplamlarından sayfada hesaplanır; burada sadece kayıt.
  revalidatePath("/beton");
}

export async function betonStokGiris(formData: FormData) {
  const session = await requireSession();
  await betonStokGirisService(session, formVerisi(formData));
  revalidatePath("/beton");
}

export async function betonReceteGuncelle(formData: FormData) {
  const session = await requireSession();
  await betonReceteGuncelleService(
    session,
    String(formData.get("id") ?? ""),
    formVerisi(formData),
  );
  revalidatePath("/beton");
}
