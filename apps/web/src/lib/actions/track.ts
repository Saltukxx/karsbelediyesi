"use server";

import { revalidatePath } from "next/cache";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { gorevYenidenAnalizForUser } from "@/lib/domain/crud-for-user";

export async function gorevYenidenAnalizEt(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.tasks);
  const id = String(formData.get("id"));
  await gorevYenidenAnalizForUser(session.user, id);
  revalidatePath(`/gorevler/${id}/takip`);
  revalidatePath("/gorevler");
}
