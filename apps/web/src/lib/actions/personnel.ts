"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

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

  const personel = await prisma.personnel.create({
    data: {
      adSoyad: String(formData.get("adSoyad")).trim(),
      unvan: bos(formData.get("unvan")),
      departmentId: bos(formData.get("departmentId")),
      telefon: bos(formData.get("telefon")),
      iseGirisTarihi: bos(formData.get("iseGirisTarihi"))
        ? new Date(String(formData.get("iseGirisTarihi")))
        : undefined,
      durum: (bos(formData.get("durum")) ?? "AKTIF") as "AKTIF" | "IZINLI" | "RAPORLU" | "AYRILDI",
      not: bos(formData.get("not")),
      saatUcret: sayi(formData.get("saatUcret")),
    },
  });

  await auditKaydet(session, "PERSONEL_OLUSTUR", {
    varlik: "Personnel",
    varlikId: personel.id,
    detay: { adSoyad: personel.adSoyad },
  });

  revalidatePath("/personel");
  redirect("/personel");
}

export async function personelGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);

  const id = String(formData.get("id"));
  await prisma.personnel.update({
    where: { id },
    data: {
      adSoyad: String(formData.get("adSoyad")).trim(),
      unvan: bos(formData.get("unvan")),
      departmentId: bos(formData.get("departmentId")) ?? null,
      telefon: bos(formData.get("telefon")),
      iseGirisTarihi: bos(formData.get("iseGirisTarihi"))
        ? new Date(String(formData.get("iseGirisTarihi")))
        : null,
      durum: (bos(formData.get("durum")) ?? "AKTIF") as "AKTIF" | "IZINLI" | "RAPORLU" | "AYRILDI",
      not: bos(formData.get("not")),
      saatUcret: sayi(formData.get("saatUcret")) ?? null,
    },
  });

  await auditKaydet(session, "PERSONEL_GUNCELLE", {
    varlik: "Personnel",
    varlikId: id,
  });

  revalidatePath("/personel");
}
