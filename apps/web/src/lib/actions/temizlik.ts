"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import type { TemizlikOperasyonTip } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { rotaSilVeyaPasifle } from "@/lib/route-delete";

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

/** "[[lat,lng],...]" JSON string'ini doğrular (cop.ts ile aynı kural) */
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

export async function temizlikRotaKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.temizlik);

  const ad = bos(formData.get("ad"));
  if (!ad) throw new Error("Rota adı gerekli");
  const koordinatlar = parseKoordinatlar(bos(formData.get("koordinatlar")));
  const oncelik = sayi(formData.get("oncelik")) ?? 2;

  const rota = await prisma.cleaningRoute.create({
    data: {
      ad,
      koordinatlar,
      oncelik: Math.min(Math.max(Math.round(oncelik), 1), 3),
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });

  await auditKaydet(session, "TEMIZLIK_ROTA_OLUSTUR", {
    varlik: "CleaningRoute",
    varlikId: rota.id,
    detay: { ad },
  });
  revalidatePath("/temizlik");
  return rota.id;
}

export async function temizlikRotaGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.temizlik);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const koordinatlarRaw = bos(formData.get("koordinatlar"));
  const oncelik = sayi(formData.get("oncelik"));
  const aktifRaw = bos(formData.get("aktif"));

  await prisma.cleaningRoute.update({
    where: { id },
    data: {
      ad: bos(formData.get("ad")),
      koordinatlar: koordinatlarRaw ? parseKoordinatlar(koordinatlarRaw) : undefined,
      oncelik: oncelik != null ? Math.min(Math.max(Math.round(oncelik), 1), 3) : undefined,
      aktif: aktifRaw != null ? aktifRaw === "true" : undefined,
      ...(formData.has("notlar") ? { notlar: bos(formData.get("notlar")) ?? null } : {}),
    },
  });

  await auditKaydet(session, "TEMIZLIK_ROTA_GUNCELLE", {
    varlik: "CleaningRoute",
    varlikId: id,
  });
  revalidatePath("/temizlik");
  return id;
}

export async function temizlikRotaSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.temizlik);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");

  const karar = await rotaSilVeyaPasifle("TEMIZLIK", id);
  const ad = karar.silindi
    ? (await prisma.cleaningRoute.delete({ where: { id } })).ad
    : undefined;

  await auditKaydet(session, karar.silindi ? "TEMIZLIK_ROTA_SIL" : "TEMIZLIK_ROTA_PASIF", {
    varlik: "CleaningRoute",
    varlikId: id,
    detay: karar.silindi ? { ad } : { sebep: karar.sebep },
  });
  revalidatePath("/temizlik");
  if (!karar.silindi) throw new Error(karar.sebep);
}

const OPERASYON_TIPLER: TemizlikOperasyonTip[] = ["SUPURME", "YIKAMA", "KARMA"];

export async function temizlikOperasyonKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.temizlik);

  const routeId = bos(formData.get("routeId"));
  if (!routeId) throw new Error("Rota seçimi gerekli");
  const tipRaw = bos(formData.get("tip"));
  const tip = OPERASYON_TIPLER.includes(tipRaw as TemizlikOperasyonTip)
    ? (tipRaw as TemizlikOperasyonTip)
    : "KARMA";

  const baslangicRaw = bos(formData.get("baslangic"));
  const baslangic = baslangicRaw ? new Date(baslangicRaw) : new Date();
  if (Number.isNaN(baslangic.getTime())) throw new Error("Geçersiz başlangıç zamanı");
  const bitisRaw = bos(formData.get("bitis"));
  const bitis = bitisRaw ? new Date(bitisRaw) : undefined;
  if (bitis && Number.isNaN(bitis.getTime())) throw new Error("Geçersiz bitiş zamanı");
  if (bitis && bitis < baslangic) throw new Error("Bitiş başlangıçtan önce olamaz");

  const operasyon = await prisma.cleaningOperation.create({
    data: {
      routeId,
      vehicleId: bos(formData.get("vehicleId")),
      driverId: bos(formData.get("driverId")),
      tip,
      baslangic,
      bitis,
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });

  await auditKaydet(session, "TEMIZLIK_OPERASYON_OLUSTUR", {
    varlik: "CleaningOperation",
    varlikId: operasyon.id,
    detay: { routeId, tip },
  });
  revalidatePath("/temizlik");
}

export async function temizlikOperasyonSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.temizlik);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  await prisma.cleaningOperation.delete({ where: { id } });

  await auditKaydet(session, "TEMIZLIK_OPERASYON_SIL", {
    varlik: "CleaningOperation",
    varlikId: id,
  });
  revalidatePath("/temizlik");
}
