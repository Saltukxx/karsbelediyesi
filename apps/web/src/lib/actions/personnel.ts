"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  personelGuncelle as personelGuncelleService,
  personelOlustur as personelOlusturService,
} from "@/lib/services/personnel";

export async function personelOlustur(formData: FormData) {
  const session = await requireSession();
  await personelOlusturService(session, formVerisi(formData));
  revalidatePath("/personel");
  redirect("/personel");
}

export async function personelGuncelle(formData: FormData) {
  const session = await requireSession();
  await personelGuncelleService(
    session,
    String(formData.get("id") ?? ""),
    formVerisi(formData),
  );
  revalidatePath("/personel");
}
