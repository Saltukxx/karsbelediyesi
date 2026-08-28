"use server";

import { revalidatePath } from "next/cache";
import type { AsfaltDurum, SikayetDurum } from "@kars/db";
import { requireSession } from "@/lib/authz";
import { islerimAsfaltDurumForUser, islerimSikayetDurumForUser } from "@/lib/domain/islerim";
import { saveComplaintPhotosFromForm } from "@/lib/complaint-photos";

export async function islerimSikayetDurum(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  const durum = String(formData.get("durum")) as SikayetDurum;
  const cozumNotu = (formData.get("cozumNotu") as string)?.trim() || undefined;
  const cozumFotolari =
    durum === "KAPATILDI"
      ? await saveComplaintPhotosFromForm(formData, "cozumFotolari")
      : [];
  await islerimSikayetDurumForUser(session, {
    id,
    durum,
    cozumNotu,
    cozumFotolari,
  });
  revalidatePath("/islerim");
  revalidatePath(`/islerim/${id}`);
  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
}

export async function islerimAsfaltDurum(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  const durumRaw = String(formData.get("durum"));
  await islerimAsfaltDurumForUser(session, { id, durum: durumRaw as AsfaltDurum });
  revalidatePath("/islerim");
  revalidatePath("/harita");
}
