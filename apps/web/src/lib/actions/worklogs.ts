"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  aracGunlukOlustur as aracGunlukOlusturService,
  personelGunlukOlustur as personelGunlukOlusturService,
} from "@/lib/services/worklogs";

export async function personelGunlukOlustur(formData: FormData) {
  const session = await requireSession();
  await personelGunlukOlusturService(session, formVerisi(formData));
  revalidatePath("/gunluk-calisma");
}

export async function aracGunlukOlustur(formData: FormData) {
  const session = await requireSession();
  await aracGunlukOlusturService(session, formVerisi(formData));
  revalidatePath("/gunluk-calisma");
  revalidatePath("/yakit");
}
