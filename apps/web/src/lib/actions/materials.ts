"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { malzemeOlusturForUser } from "@/lib/domain/crud-for-user";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

export async function malzemeOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.materials);
  await malzemeOlusturForUser(session.user, {
    kod: String(formData.get("kod")).trim(),
    ad: String(formData.get("ad")).trim(),
    kategori: String(formData.get("kategori")).trim(),
    birim: String(formData.get("birim")).trim(),
    depoLokasyon: bos(formData.get("depoLokasyon")),
    kritikStok: sayi(formData.get("kritikStok")) ?? 0,
    birimFiyat: sayi(formData.get("birimFiyat")),
    aciklama: bos(formData.get("aciklama")),
  });
  revalidatePath("/malzeme-depo");
}

export async function malzemeGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.materials);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");

  await prisma.material.update({
    where: { id },
    data: {
      kod: String(formData.get("kod")).trim(),
      ad: String(formData.get("ad")).trim(),
      kategori: String(formData.get("kategori")).trim(),
      birim: String(formData.get("birim")).trim(),
      depoLokasyon: bos(formData.get("depoLokasyon")) ?? null,
      kritikStok: sayi(formData.get("kritikStok")) ?? 0,
      birimFiyat: sayi(formData.get("birimFiyat")) ?? null,
      aciklama: bos(formData.get("aciklama")) ?? null,
    },
  });
  await auditKaydet(session, "MALZEME_GUNCELLE", {
    varlik: "Material",
    varlikId: id,
  });
  revalidatePath("/malzeme-depo");
}

export async function malzemePasifeAl(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.materials);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");

  await prisma.material.update({
    where: { id },
    data: { aktif: false },
  });
  await auditKaydet(session, "MALZEME_PASIFE_AL", {
    varlik: "Material",
    varlikId: id,
  });
  revalidatePath("/malzeme-depo");
}

export async function stokHareketOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.materials);

  const materialId = String(formData.get("materialId"));
  const tip = String(formData.get("tip")) as "GIRIS" | "CIKIS";
  const miktar = sayi(formData.get("miktar"));
  if (!miktar || miktar <= 0) {
    throw new Error("Miktar 0'dan büyük olmalı");
  }
  if (tip !== "GIRIS" && tip !== "CIKIS") {
    throw new Error("Geçersiz hareket tipi");
  }

  if (tip === "CIKIS") {
    const movements = await prisma.materialMovement.findMany({
      where: { materialId },
      select: { tip: true, miktar: true },
    });
    const giris = movements
      .filter((m) => m.tip === "GIRIS")
      .reduce((s, m) => s + Number(m.miktar), 0);
    const cikis = movements
      .filter((m) => m.tip === "CIKIS")
      .reduce((s, m) => s + Number(m.miktar), 0);
    const stok = mevcutStok(giris, cikis);
    if (miktar > stok) {
      throw new Error(`Yetersiz stok (mevcut: ${stok})`);
    }
  }

  await prisma.materialMovement.create({
    data: {
      materialId,
      tarih: new Date(String(formData.get("tarih"))),
      tip,
      miktar,
      departmentId: bos(formData.get("departmentId")),
      belgeNo: bos(formData.get("belgeNo")),
      aciklama: bos(formData.get("aciklama")),
      // Yalnızca ÇIKIŞ hareketi bir göreve bağlanır (iş başına maliyet)
      vehicleTaskId: tip === "CIKIS" ? bos(formData.get("vehicleTaskId")) : null,
    },
  });
  await auditKaydet(session, "STOK_HAREKET_OLUSTUR", {
    varlik: "MaterialMovement",
    detay: { materialId, tip, miktar },
  });
  revalidatePath("/malzeme-depo");
}

export async function stokHareketSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.materials);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");

  const kayit = await prisma.materialMovement.delete({ where: { id } });
  await auditKaydet(session, "STOK_HAREKET_SIL", {
    varlik: "MaterialMovement",
    varlikId: id,
    detay: { materialId: kayit.materialId, tip: kayit.tip },
  });
  revalidatePath("/malzeme-depo");
}
