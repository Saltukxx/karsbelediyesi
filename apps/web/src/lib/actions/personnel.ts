"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import {
  personelGuncelleForUser,
  personelOlusturForUser,
  personelPasifeAlForUser,
} from "@/lib/domain/personnel";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  if (s === undefined) return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export async function personelOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);
  await personelOlusturForUser(session, {
    adSoyad: String(formData.get("adSoyad")).trim(),
    unvan: bos(formData.get("unvan")),
    departmentId: bos(formData.get("departmentId")),
    telefon: bos(formData.get("telefon")),
    iseGirisTarihi: bos(formData.get("iseGirisTarihi")),
    durum: (bos(formData.get("durum")) ?? "AKTIF") as never,
    not: bos(formData.get("not")),
    saatUcret: sayi(formData.get("saatUcret")),
  });
  revalidatePath("/personel");
  redirect("/personel");
}

export async function personelGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);
  await personelGuncelleForUser(session, {
    id: String(formData.get("id")),
    adSoyad: String(formData.get("adSoyad")).trim(),
    unvan: bos(formData.get("unvan")),
    departmentId: bos(formData.get("departmentId")),
    telefon: bos(formData.get("telefon")),
    iseGirisTarihi: bos(formData.get("iseGirisTarihi")),
    durum: (bos(formData.get("durum")) ?? "AKTIF") as never,
    not: bos(formData.get("not")),
    saatUcret: sayi(formData.get("saatUcret")),
  });
  revalidatePath("/personel");
}

export async function personelPasifeAl(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);
  await personelPasifeAlForUser(session, String(formData.get("id") ?? "").trim());
  revalidatePath("/personel");
}
