"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import type { KisOperasyonTip, KisRotaTip } from "@kars/db";
import { mevcutStok } from "@kars/shared";
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

const ROTA_TIPLER: KisRotaTip[] = ["KAR_KUREME", "TUZLAMA", "KARMA"];
const OPERASYON_TIPLER: KisOperasyonTip[] = ["KURUME", "TUZLAMA", "KARMA"];

/** "[[lat,lng],...]" JSON string'ini doğrular (harita.ts ile aynı kural) */
function parseKoordinatlar(raw: string | undefined): [number, number][] {
  if (!raw) throw new Error("Koordinat gerekli");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Koordinat formatı geçersiz");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 2 ||
    !parsed.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]),
    )
  ) {
    throw new Error("En az 2 geçerli koordinat gerekli");
  }
  return parsed as [number, number][];
}

// ── ROTA CRUD ────────────────────────────────────────────────────────

export async function kisRotaKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.kis);

  const ad = bos(formData.get("ad"));
  if (!ad) throw new Error("Rota adı gerekli");
  const koordinatlar = parseKoordinatlar(bos(formData.get("koordinatlar")));
  const tipRaw = bos(formData.get("tip"));
  const oncelik = sayi(formData.get("oncelik")) ?? 2;

  const rota = await prisma.winterRoute.create({
    data: {
      ad,
      koordinatlar,
      tip: ROTA_TIPLER.includes(tipRaw as KisRotaTip) ? (tipRaw as KisRotaTip) : "KARMA",
      oncelik: Math.min(Math.max(Math.round(oncelik), 1), 3),
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });

  await auditKaydet(session, "KIS_ROTA_OLUSTUR", {
    varlik: "WinterRoute",
    varlikId: rota.id,
    detay: { ad },
  });
  revalidatePath("/kis");
}

export async function kisRotaGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.kis);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const koordinatlarRaw = bos(formData.get("koordinatlar"));
  const tipRaw = bos(formData.get("tip"));
  const oncelik = sayi(formData.get("oncelik"));
  const aktifRaw = bos(formData.get("aktif"));

  await prisma.winterRoute.update({
    where: { id },
    data: {
      ad: bos(formData.get("ad")),
      koordinatlar: koordinatlarRaw ? parseKoordinatlar(koordinatlarRaw) : undefined,
      tip: ROTA_TIPLER.includes(tipRaw as KisRotaTip) ? (tipRaw as KisRotaTip) : undefined,
      oncelik: oncelik != null ? Math.min(Math.max(Math.round(oncelik), 1), 3) : undefined,
      aktif: aktifRaw != null ? aktifRaw === "true" : undefined,
      notlar: bos(formData.get("notlar")) ?? null,
    },
  });

  await auditKaydet(session, "KIS_ROTA_GUNCELLE", {
    varlik: "WinterRoute",
    varlikId: id,
  });
  revalidatePath("/kis");
}

export async function kisRotaSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.kis);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const silinen = await prisma.winterRoute.delete({ where: { id } });
  await auditKaydet(session, "KIS_ROTA_SIL", {
    varlik: "WinterRoute",
    varlikId: id,
    detay: { ad: silinen.ad },
  });
  revalidatePath("/kis");
}

// ── OPERASYON ────────────────────────────────────────────────────────

export async function kisOperasyonKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.kis);

  const routeId = bos(formData.get("routeId"));
  if (!routeId) throw new Error("Rota seçimi gerekli");
  const tipRaw = bos(formData.get("tip"));
  const tip = OPERASYON_TIPLER.includes(tipRaw as KisOperasyonTip)
    ? (tipRaw as KisOperasyonTip)
    : "KARMA";

  const baslangicRaw = bos(formData.get("baslangic"));
  const baslangic = baslangicRaw ? new Date(baslangicRaw) : new Date();
  if (Number.isNaN(baslangic.getTime())) throw new Error("Geçersiz başlangıç zamanı");
  const bitisRaw = bos(formData.get("bitis"));
  const bitis = bitisRaw ? new Date(bitisRaw) : undefined;
  if (bitis && Number.isNaN(bitis.getTime())) throw new Error("Geçersiz bitiş zamanı");
  if (bitis && bitis < baslangic) throw new Error("Bitiş başlangıçtan önce olamaz");

  const tuzKg = sayi(formData.get("tuzKg"));
  if (tuzKg != null && tuzKg <= 0) throw new Error("Tuz miktarı 0'dan büyük olmalı");
  const tuzMaterialId = bos(formData.get("tuzMaterialId"));
  if (tuzKg != null && !tuzMaterialId) {
    throw new Error("Tuz düşümü için malzeme seçimi gerekli");
  }

  const operasyon = await prisma.$transaction(async (tx) => {
    const op = await tx.winterOperation.create({
      data: {
        routeId,
        tip,
        vehicleId: bos(formData.get("vehicleId")),
        driverId: bos(formData.get("driverId")),
        baslangic,
        bitis,
        tuzKg,
        notlar: bos(formData.get("notlar")),
        createdById: session.user.id,
      },
    });

    if (tuzKg != null && tuzMaterialId) {
      const movements = await tx.materialMovement.findMany({
        where: { materialId: tuzMaterialId },
        select: { tip: true, miktar: true },
      });
      const giris = movements
        .filter((m) => m.tip === "GIRIS")
        .reduce((s, m) => s + Number(m.miktar), 0);
      const cikis = movements
        .filter((m) => m.tip === "CIKIS")
        .reduce((s, m) => s + Number(m.miktar), 0);
      const stok = mevcutStok(giris, cikis);
      if (tuzKg > stok) {
        throw new Error(`Yetersiz tuz stoğu (mevcut: ${stok})`);
      }
      await tx.materialMovement.create({
        data: {
          materialId: tuzMaterialId,
          tarih: baslangic,
          tip: "CIKIS",
          miktar: tuzKg,
          aciklama: `Kış operasyonu tuz düşümü (${op.id})`,
          winterOperationId: op.id,
        },
      });
    }

    return op;
  });

  await auditKaydet(session, "KIS_OPERASYON_OLUSTUR", {
    varlik: "WinterOperation",
    varlikId: operasyon.id,
    detay: { routeId, tip, tuzKg },
  });
  revalidatePath("/kis");
  revalidatePath("/malzeme-depo");
}

export async function kisOperasyonSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.kis);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");

  await prisma.$transaction(async (tx) => {
    await tx.materialMovement.deleteMany({ where: { winterOperationId: id } });
    await tx.winterOperation.delete({ where: { id } });
  });

  await auditKaydet(session, "KIS_OPERASYON_SIL", {
    varlik: "WinterOperation",
    varlikId: id,
  });
  revalidatePath("/kis");
  revalidatePath("/malzeme-depo");
}
