"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import {
  kontrolFormuOlusturForUser,
  kontrolKalemKaydetForUser,
  kontrolFormuOnayaGonderForUser,
  kontrolFormuOnaylaForUser,
  type ChecklistPeriyot,
  type ChecklistSonuc,
} from "@/lib/domain/checklists";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

export async function kontrolFormuOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.checklists);
  const submission = await kontrolFormuOlusturForUser(session, {
    templateId: String(formData.get("templateId")),
    vehicleId: String(formData.get("vehicleId")),
    ay: Number(formData.get("ay")),
    yilDonem: Number(formData.get("yilDonem")),
    sorumluOperatorTeknisyen: bos(formData.get("sorumluOperatorTeknisyen")),
    santiyeLokasyon: bos(formData.get("santiyeLokasyon")),
  });
  revalidatePath("/kontrol-listeleri");
  redirect(`/kontrol-listeleri/${submission.id}`);
}

export async function kontrolKalemKaydet(formData: FormData) {
  await requireRoles(ACTION_ROLES.checklists);
  const submissionId = String(formData.get("submissionId"));
  await kontrolKalemKaydetForUser({
    submissionId,
    templateItemId: String(formData.get("templateItemId")),
    periyot: String(formData.get("periyot")) as ChecklistPeriyot,
    sonuc: String(formData.get("sonuc")) as ChecklistSonuc,
    aciklamaNot: bos(formData.get("aciklamaNot")),
  });
  revalidatePath(`/kontrol-listeleri/${submissionId}`);
  revalidatePath("/bakim");
}

export async function kontrolFormuOnayaGonder(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.checklists);
  const id = String(formData.get("id"));
  await kontrolFormuOnayaGonderForUser(session, {
    id,
    teknisyenAdi: bos(formData.get("teknisyenAdi")),
    sefAmirAdi: bos(formData.get("sefAmirAdi")),
  });
  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}

export async function kontrolFormuOnayla(formData: FormData) {
  const session = await requireRoles(["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  const id = String(formData.get("id"));
  await kontrolFormuOnaylaForUser(session, {
    id,
    karar: String(formData.get("karar")) as "ONAYLANDI" | "REDDEDILDI",
    sefAmirAdi: bos(formData.get("sefAmirAdi")),
  });
  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}
