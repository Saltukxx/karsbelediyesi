"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import {
  kontrolFormuOlustur as kontrolFormuOlusturServis,
  kontrolFormuOnayaGonder as kontrolFormuOnayaGonderServis,
  kontrolFormuOnayla as kontrolFormuOnaylaServis,
  kontrolKalemKaydet as kontrolKalemKaydetServis,
} from "@/lib/services/checklists";

export async function kontrolFormuOlustur(formData: FormData) {
  const session = await requireSession();
  const submission = await kontrolFormuOlusturServis(session, formVerisi(formData));

  revalidatePath("/kontrol-listeleri");
  redirect(`/kontrol-listeleri/${submission.id}`);
}

export async function kontrolKalemKaydet(formData: FormData) {
  const session = await requireSession();
  const submissionId = String(formData.get("submissionId") ?? "");
  await kontrolKalemKaydetServis(session, submissionId, formVerisi(formData));

  revalidatePath(`/kontrol-listeleri/${submissionId}`);
  revalidatePath("/bakim");
}

export async function kontrolFormuOnayaGonder(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await kontrolFormuOnayaGonderServis(session, id, formVerisi(formData));

  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}

export async function kontrolFormuOnayla(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await kontrolFormuOnaylaServis(session, id, formVerisi(formData));

  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}
