"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { agregaParametreKaydet as agregaParametreKaydetService } from "@/lib/services/agrega";
import { formVerisi } from "@/lib/services/base";

export async function agregaParametreKaydet(formData: FormData) {
  const session = await requireSession();
  await agregaParametreKaydetService(session, formVerisi(formData));
  revalidatePath("/agrega");
}
