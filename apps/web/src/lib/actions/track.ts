"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { gorevYenidenAnalizEt as gorevYenidenAnalizEtServis } from "@/lib/services/tasks";

/** Görev takip raporunu yeniden üretir (rapor sayfasındaki buton) */
export async function gorevYenidenAnalizEt(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await gorevYenidenAnalizEtServis(session, id);

  revalidatePath(`/gorevler/${id}/takip`);
  revalidatePath("/gorevler");
}
