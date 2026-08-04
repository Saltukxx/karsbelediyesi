"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles, type AppSession } from "@/lib/authz";
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

/** Müdür yalnız kendi biriminde işlem yapabilir; müdürlük atanmamışsa yetkisiz. */
function assertPersonelDeptAccess(
  session: AppSession,
  departmentId: string | null | undefined,
) {
  if (session.user.role !== "DEPARTMENT_MANAGER") return;
  if (!session.user.departmentId) throw new Error("Yetkisiz");
  if (departmentId !== session.user.departmentId) throw new Error("Yetkisiz");
}

export async function personelOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);

  let departmentId = bos(formData.get("departmentId"));
  if (session.user.role === "DEPARTMENT_MANAGER") {
    if (!session.user.departmentId) throw new Error("Yetkisiz");
    departmentId = session.user.departmentId;
  }

  const durumRaw = bos(formData.get("durum")) ?? "AKTIF";
  const durum = (
    durumRaw === "AYRILDI" ? "AKTIF" : durumRaw
  ) as "AKTIF" | "IZINLI" | "RAPORLU";

  const personel = await prisma.personnel.create({
    data: {
      adSoyad: String(formData.get("adSoyad")).trim(),
      unvan: bos(formData.get("unvan")),
      departmentId,
      telefon: bos(formData.get("telefon")),
      iseGirisTarihi: bos(formData.get("iseGirisTarihi"))
        ? new Date(String(formData.get("iseGirisTarihi")))
        : undefined,
      durum,
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
  const mevcut = await prisma.personnel.findUnique({
    where: { id },
    select: { id: true, departmentId: true, durum: true },
  });
  if (!mevcut) throw new Error("Personel bulunamadı");
  assertPersonelDeptAccess(session, mevcut.departmentId);

  let departmentId = bos(formData.get("departmentId")) ?? null;
  if (session.user.role === "DEPARTMENT_MANAGER") {
    departmentId = session.user.departmentId;
  }

  // Aktif listeden AYRILDI seçilemez (Pasife al kullan); pasif listeden yeniden aktifleştirilebilir
  const durumRaw = bos(formData.get("durum")) ?? "AKTIF";
  const durum = (
    mevcut.durum !== "AYRILDI" && durumRaw === "AYRILDI"
      ? mevcut.durum
      : durumRaw
  ) as "AKTIF" | "IZINLI" | "RAPORLU" | "AYRILDI";

  await prisma.personnel.update({
    where: { id },
    data: {
      adSoyad: String(formData.get("adSoyad")).trim(),
      unvan: bos(formData.get("unvan")),
      departmentId,
      telefon: bos(formData.get("telefon")),
      iseGirisTarihi: bos(formData.get("iseGirisTarihi"))
        ? new Date(String(formData.get("iseGirisTarihi")))
        : null,
      durum,
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

/** Yumuşak silme: personeli AYRILDI durumuna alır (kalıcı silme yok). */
export async function personelPasifeAl(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.personnel);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Personel seçilmedi");

  const mevcut = await prisma.personnel.findUnique({
    where: { id },
    select: { id: true, adSoyad: true, durum: true, departmentId: true },
  });
  if (!mevcut) throw new Error("Personel bulunamadı");
  if (mevcut.durum === "AYRILDI") {
    revalidatePath("/personel");
    return;
  }

  assertPersonelDeptAccess(session, mevcut.departmentId);

  await prisma.personnel.update({
    where: { id },
    data: { durum: "AYRILDI" },
  });

  await auditKaydet(session, "PERSONEL_PASIFE_AL", {
    varlik: "Personnel",
    varlikId: id,
    detay: { adSoyad: mevcut.adSoyad, eskiDurum: mevcut.durum },
  });

  revalidatePath("/personel");
}
