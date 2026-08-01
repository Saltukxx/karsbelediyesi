"use server";

import { revalidatePath } from "next/cache";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import * as tanim from "@/lib/services/definitions";

/**
 * Web formları servis katmanını çağırır; doğrulama, yetki ve denetim kaydı
 * `services/definitions.ts` içinde, `/api/v1/definitions/*` uçlarıyla ortak.
 */
async function tanimIslemi<T>(
  islem: (actor: Awaited<ReturnType<typeof requireRoles>>) => Promise<T>,
): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.definitions);
  await islem(session);
  revalidatePath("/tanimlar");
}

export async function mahalleOlustur(formData: FormData) {
  await tanimIslemi((s) => tanim.mahalleOlustur(s, formVerisi(formData)));
}

export async function mudurlukOlustur(formData: FormData) {
  await tanimIslemi((s) => tanim.mudurlukOlustur(s, formVerisi(formData)));
}

export async function mudurlukGuncelle(formData: FormData) {
  const id = String(formData.get("id"));
  await tanimIslemi((s) => tanim.mudurlukGuncelle(s, id, formVerisi(formData)));
}

export async function sikayetTuruOlustur(formData: FormData) {
  await tanimIslemi((s) => tanim.sikayetTuruOlustur(s, formVerisi(formData)));
}

export async function sikayetTuruGuncelle(formData: FormData) {
  const id = String(formData.get("id"));
  await tanimIslemi((s) => tanim.sikayetTuruGuncelle(s, id, formVerisi(formData)));
}

export async function aracCinsiOlustur(formData: FormData) {
  await tanimIslemi((s) => tanim.aracCinsiOlustur(s, formVerisi(formData)));
}

export async function kullaniciOlustur(formData: FormData) {
  await tanimIslemi((s) => tanim.kullaniciOlustur(s, formVerisi(formData)));
}

export async function kullaniciGuncelle(formData: FormData) {
  const id = String(formData.get("id"));
  await tanimIslemi((s) => tanim.kullaniciGuncelle(s, id, formVerisi(formData)));
}
