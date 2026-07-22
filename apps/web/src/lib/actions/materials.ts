"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

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

  const malzeme = await prisma.material.create({
    data: {
      kod: String(formData.get("kod")).trim(),
      ad: String(formData.get("ad")).trim(),
      kategori: String(formData.get("kategori")).trim(),
      birim: String(formData.get("birim")).trim(),
      depoLokasyon: bos(formData.get("depoLokasyon")),
      kritikStok: sayi(formData.get("kritikStok")) ?? 0,
      birimFiyat: sayi(formData.get("birimFiyat")),
      aciklama: bos(formData.get("aciklama")),
    },
  });
  await auditKaydet(session, "MALZEME_OLUSTUR", {
    varlik: "Material",
    varlikId: malzeme.id,
    detay: { kod: malzeme.kod, ad: malzeme.ad },
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
    },
  });
  await auditKaydet(session, "STOK_HAREKET_OLUSTUR", {
    varlik: "MaterialMovement",
    detay: { materialId, tip, miktar },
  });
  revalidatePath("/malzeme-depo");
}
