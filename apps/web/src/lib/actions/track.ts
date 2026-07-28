"use server";

import { revalidatePath } from "next/cache";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { canAccessTask, loadTaskForAccess, toAccessUser } from "@/lib/access";
import { auditKaydet } from "@/lib/audit";
import { gorevIziAnalizEt } from "@/lib/route-analysis";

/** Görev takip raporunu yeniden üretir (rapor sayfasındaki buton) */
export async function gorevYenidenAnalizEt(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.tasks);

  const id = String(formData.get("id"));
  const gorev = await loadTaskForAccess(id);
  if (!gorev || !canAccessTask(toAccessUser(session.user), gorev)) {
    throw new Error("Yetkisiz");
  }

  const sonuc = await gorevIziAnalizEt(id);
  if (!sonuc) {
    throw new Error("Bu görev bir dispatch rotasına bağlı değil — analiz yapılamaz");
  }

  await auditKaydet(session, "GOREV_TAKIP_ANALIZ", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo, sonuc: sonuc.sonuc },
  });

  revalidatePath(`/gorevler/${id}/takip`);
  revalidatePath("/gorevler");
}
