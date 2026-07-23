"use server";

import { revalidatePath } from "next/cache";
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

/** "[[lat,lng],...]" JSON string'ini doğrular (kis.ts ile aynı kural) */
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

/** Form checkbox'larından ISO gün listesi [1..7] */
function parseGunler(formData: FormData): number[] {
  const gunler = formData
    .getAll("gunler")
    .map((g) => Number(g))
    .filter((g) => Number.isInteger(g) && g >= 1 && g <= 7);
  return [...new Set(gunler)].sort((a, b) => a - b);
}

// ── ROTA CRUD ────────────────────────────────────────────────────────

export async function copRotaKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.cop);

  const ad = bos(formData.get("ad"));
  if (!ad) throw new Error("Rota adı gerekli");
  const koordinatlar = parseKoordinatlar(bos(formData.get("koordinatlar")));
  const gunler = parseGunler(formData);
  if (gunler.length === 0) throw new Error("En az bir toplama günü seçin");
  const oncelik = sayi(formData.get("oncelik")) ?? 2;

  const rota = await prisma.wasteRoute.create({
    data: {
      ad,
      koordinatlar,
      gunler,
      oncelik: Math.min(Math.max(Math.round(oncelik), 1), 3),
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });

  await auditKaydet(session, "COP_ROTA_OLUSTUR", {
    varlik: "WasteRoute",
    varlikId: rota.id,
    detay: { ad },
  });
  revalidatePath("/cop");
}

export async function copRotaGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.cop);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const koordinatlarRaw = bos(formData.get("koordinatlar"));
  const oncelik = sayi(formData.get("oncelik"));
  const aktifRaw = bos(formData.get("aktif"));
  // Gün güncellemesi yalnızca form günleri gönderdiyse yapılır (aktif toggle formu göndermez)
  const gunler = formData.has("gunler") ? parseGunler(formData) : undefined;
  if (gunler !== undefined && gunler.length === 0) {
    throw new Error("En az bir toplama günü seçin");
  }

  await prisma.wasteRoute.update({
    where: { id },
    data: {
      ad: bos(formData.get("ad")),
      koordinatlar: koordinatlarRaw ? parseKoordinatlar(koordinatlarRaw) : undefined,
      gunler,
      oncelik: oncelik != null ? Math.min(Math.max(Math.round(oncelik), 1), 3) : undefined,
      aktif: aktifRaw != null ? aktifRaw === "true" : undefined,
      ...(formData.has("notlar") ? { notlar: bos(formData.get("notlar")) ?? null } : {}),
    },
  });

  await auditKaydet(session, "COP_ROTA_GUNCELLE", {
    varlik: "WasteRoute",
    varlikId: id,
  });
  revalidatePath("/cop");
}

export async function copRotaSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.cop);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const silinen = await prisma.wasteRoute.delete({ where: { id } });
  await auditKaydet(session, "COP_ROTA_SIL", {
    varlik: "WasteRoute",
    varlikId: id,
    detay: { ad: silinen.ad },
  });
  revalidatePath("/cop");
}

// ── TOPLAMA ──────────────────────────────────────────────────────────

export async function copToplamaKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.cop);

  const routeId = bos(formData.get("routeId"));
  if (!routeId) throw new Error("Rota seçimi gerekli");

  const baslangicRaw = bos(formData.get("baslangic"));
  const baslangic = baslangicRaw ? new Date(baslangicRaw) : new Date();
  if (Number.isNaN(baslangic.getTime())) throw new Error("Geçersiz başlangıç zamanı");
  const bitisRaw = bos(formData.get("bitis"));
  const bitis = bitisRaw ? new Date(bitisRaw) : undefined;
  if (bitis && Number.isNaN(bitis.getTime())) throw new Error("Geçersiz bitiş zamanı");
  if (bitis && bitis < baslangic) throw new Error("Bitiş başlangıçtan önce olamaz");

  const toplama = await prisma.wasteCollection.create({
    data: {
      routeId,
      vehicleId: bos(formData.get("vehicleId")),
      driverId: bos(formData.get("driverId")),
      baslangic,
      bitis,
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });

  await auditKaydet(session, "COP_TOPLAMA_OLUSTUR", {
    varlik: "WasteCollection",
    varlikId: toplama.id,
    detay: { routeId },
  });
  revalidatePath("/cop");
}

export async function copToplamaSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.cop);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  await prisma.wasteCollection.delete({ where: { id } });

  await auditKaydet(session, "COP_TOPLAMA_SIL", {
    varlik: "WasteCollection",
    varlikId: id,
  });
  revalidatePath("/cop");
}
