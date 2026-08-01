"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { formVerisi } from "@/lib/services/base";
import * as araclarServis from "@/lib/services/vehicles";

// ── ARAÇ (Excel: Araç Envanteri + Araç Havuzu birleşik) ──────────────────────

export async function aracOlustur(formData: FormData) {
  const session = await requireSession();
  const arac = await araclarServis.aracOlustur(session, formVerisi(formData));
  revalidatePath("/araclar");
  redirect(`/araclar/${arac.id}`);
}

export async function aracGuncelle(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await araclarServis.aracGuncelle(session, id, formVerisi(formData));
  revalidatePath("/araclar");
  revalidatePath(`/araclar/${id}`);
  redirect(`/araclar/${id}`);
}

// ── BAKIM (Excel: Bakım Takip — 11 sütun) ────────────────────────────────────

export async function bakimOlustur(formData: FormData) {
  const session = await requireSession();
  await araclarServis.bakimOlustur(session, formVerisi(formData));
  revalidatePath("/bakim");
  revalidatePath("/araclar");
  redirect("/bakim");
}

// ── YAKIT (Excel: Yakıt Takip — tutar = litre × birim fiyat, server-side) ────

export async function yakitOlustur(formData: FormData) {
  const session = await requireSession();
  await araclarServis.yakitOlustur(session, formVerisi(formData));
  revalidatePath("/yakit");
  redirect("/yakit");
}
