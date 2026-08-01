"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  bitumAyarKaydet as bitumAyarKaydetService,
  bitumHareketOlustur as bitumHareketOlusturService,
} from "@/lib/services/bitum";

export async function bitumAyarKaydet(formData: FormData) {
  const session = await requireSession();
  await bitumAyarKaydetService(session, formVerisi(formData));
  revalidatePath("/bitum");
}

export async function bitumHareketOlustur(formData: FormData) {
  const session = await requireSession();
  await bitumHareketOlusturService(session, formVerisi(formData));
  revalidatePath("/bitum");
}
