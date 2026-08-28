import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

export type PersonnelInput = {
  id?: string;
  adSoyad: string;
  unvan?: string;
  departmentId?: string | null;
  telefon?: string;
  iseGirisTarihi?: string;
  durum?: "AKTIF" | "IZINLI" | "RAPORLU" | "AYRILDI";
  not?: string;
  saatUcret?: number;
};

function assertPersonelDeptAccess(
  session: AppSession,
  departmentId: string | null | undefined,
) {
  if (session.user.role !== "DEPARTMENT_MANAGER") return;
  if (!session.user.departmentId) throw new Error("Yetkisiz");
  if (departmentId !== session.user.departmentId) throw new Error("Yetkisiz");
}

function resolveDept(session: AppSession, departmentId?: string | null) {
  if (session.user.role === "DEPARTMENT_MANAGER") {
    if (!session.user.departmentId) throw new Error("Yetkisiz");
    return session.user.departmentId;
  }
  return departmentId ?? undefined;
}

export async function personelOlusturForUser(session: AppSession, input: PersonnelInput) {
  const departmentId = resolveDept(session, input.departmentId);
  const durumRaw = input.durum ?? "AKTIF";
  const durum = (durumRaw === "AYRILDI" ? "AKTIF" : durumRaw) as
    | "AKTIF"
    | "IZINLI"
    | "RAPORLU";
  const personel = await prisma.personnel.create({
    data: {
      adSoyad: input.adSoyad.trim(),
      unvan: input.unvan,
      departmentId,
      telefon: input.telefon,
      iseGirisTarihi: input.iseGirisTarihi ? new Date(input.iseGirisTarihi) : undefined,
      durum,
      not: input.not,
      saatUcret: input.saatUcret,
    },
  });
  await auditKaydet(session, "PERSONEL_OLUSTUR", {
    varlik: "Personnel",
    varlikId: personel.id,
    detay: { adSoyad: personel.adSoyad },
  });
  return personel;
}

export async function personelGuncelleForUser(session: AppSession, input: PersonnelInput) {
  if (!input.id) throw new Error("Personel seçilmedi");
  const mevcut = await prisma.personnel.findUnique({
    where: { id: input.id },
    select: { id: true, departmentId: true, durum: true },
  });
  if (!mevcut) throw new Error("Personel bulunamadı");
  assertPersonelDeptAccess(session, mevcut.departmentId);
  const departmentId = resolveDept(session, input.departmentId) ?? null;
  const durumRaw = input.durum ?? "AKTIF";
  const durum = (
    mevcut.durum !== "AYRILDI" && durumRaw === "AYRILDI" ? mevcut.durum : durumRaw
  ) as "AKTIF" | "IZINLI" | "RAPORLU" | "AYRILDI";
  await prisma.personnel.update({
    where: { id: input.id },
    data: {
      adSoyad: input.adSoyad.trim(),
      unvan: input.unvan,
      departmentId,
      telefon: input.telefon,
      iseGirisTarihi: input.iseGirisTarihi ? new Date(input.iseGirisTarihi) : null,
      durum,
      not: input.not,
      saatUcret: input.saatUcret ?? null,
    },
  });
  await auditKaydet(session, "PERSONEL_GUNCELLE", {
    varlik: "Personnel",
    varlikId: input.id,
  });
  return { ok: true };
}

export async function personelPasifeAlForUser(session: AppSession, id: string) {
  if (!id) throw new Error("Personel seçilmedi");
  const mevcut = await prisma.personnel.findUnique({
    where: { id },
    select: { id: true, adSoyad: true, durum: true, departmentId: true },
  });
  if (!mevcut) throw new Error("Personel bulunamadı");
  if (mevcut.durum === "AYRILDI") return { ok: true };
  assertPersonelDeptAccess(session, mevcut.departmentId);
  await prisma.personnel.update({ where: { id }, data: { durum: "AYRILDI" } });
  await auditKaydet(session, "PERSONEL_PASIFE_AL", {
    varlik: "Personnel",
    varlikId: id,
    detay: { adSoyad: mevcut.adSoyad, eskiDurum: mevcut.durum },
  });
  return { ok: true };
}
