"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  malzemeOlustur as malzemeOlusturService,
  stokHareketOlustur as stokHareketOlusturService,
} from "@/lib/services/materials";

export async function malzemeOlustur(formData: FormData) {
  const session = await requireSession();
  await malzemeOlusturService(session, formVerisi(formData));
  revalidatePath("/malzeme-depo");
}

export async function stokHareketOlustur(formData: FormData) {
  const session = await requireSession();
  await stokHareketOlusturService(session, formVerisi(formData));
  revalidatePath("/malzeme-depo");
}
