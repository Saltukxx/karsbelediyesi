"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import type { AsfaltDurum, HazardDurum, HazardTip } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import {
  deleteHazardPhotoFile,
  isAllowedPhotoMime,
  saveHazardPhoto,
} from "@/lib/hazard-photos";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

const ASFALT_DURUMLAR: AsfaltDurum[] = ["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI"];
const HAZARD_TIPLER: HazardTip[] = ["CUKUR", "ENGEL", "DIGER"];
const HAZARD_DURUMLAR: HazardDurum[] = ["ACIK", "GIDERILDI"];

/** "[[lat,lng],...]" JSON string'ini doğrular */
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

export async function asfaltYolKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.harita);

  const ad = bos(formData.get("ad"));
  if (!ad) throw new Error("Yol adı gerekli");
  const koordinatlar = parseKoordinatlar(bos(formData.get("koordinatlar")));
  const durumRaw = bos(formData.get("durum"));
  const durum = ASFALT_DURUMLAR.includes(durumRaw as AsfaltDurum)
    ? (durumRaw as AsfaltDurum)
    : "TAMAMLANDI";
  const dokumTarihi = bos(formData.get("dokumTarihi"));

  await prisma.asphaltRoad.create({
    data: {
      ad,
      koordinatlar,
      durum,
      dokumTarihi: dokumTarihi ? new Date(dokumTarihi) : undefined,
      notlar: bos(formData.get("notlar")),
      createdById: session.user.id,
    },
  });
  revalidatePath("/harita");
}

export async function asfaltYolGuncelle(formData: FormData) {
  await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const ad = bos(formData.get("ad"));
  const durumRaw = bos(formData.get("durum"));
  const dokumTarihi = bos(formData.get("dokumTarihi"));
  const koordinatlarRaw = bos(formData.get("koordinatlar"));

  await prisma.asphaltRoad.update({
    where: { id },
    data: {
      ad,
      koordinatlar: koordinatlarRaw ? parseKoordinatlar(koordinatlarRaw) : undefined,
      durum: ASFALT_DURUMLAR.includes(durumRaw as AsfaltDurum)
        ? (durumRaw as AsfaltDurum)
        : undefined,
      dokumTarihi: dokumTarihi ? new Date(dokumTarihi) : undefined,
      notlar: bos(formData.get("notlar")) ?? null,
    },
  });
  revalidatePath("/harita");
}

export async function asfaltYolSil(formData: FormData) {
  await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  await prisma.asphaltRoad.delete({ where: { id } });
  revalidatePath("/harita");
}

export async function engelKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.harita);

  const lat = Number(bos(formData.get("lat")));
  const lng = Number(bos(formData.get("lng")));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Konum gerekli");
  }
  const tipRaw = bos(formData.get("tip"));
  const tip = HAZARD_TIPLER.includes(tipRaw as HazardTip)
    ? (tipRaw as HazardTip)
    : "CUKUR";

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of photoFiles) {
    if (!isAllowedPhotoMime(f.type)) {
      throw new Error("Sadece JPEG/PNG/WebP fotoğraf yüklenebilir");
    }
  }

  const savedNames: string[] = [];
  for (const f of photoFiles) {
    savedNames.push(await saveHazardPhoto(f));
  }

  await prisma.roadHazard.create({
    data: {
      tip,
      lat,
      lng,
      aciklama: bos(formData.get("aciklama")),
      createdById: session.user.id,
      photos: { create: savedNames.map((url) => ({ url })) },
    },
  });
  revalidatePath("/harita");
}

export async function engelDurumGuncelle(formData: FormData) {
  await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  const durumRaw = bos(formData.get("durum"));
  if (!id || !HAZARD_DURUMLAR.includes(durumRaw as HazardDurum)) {
    throw new Error("Geçersiz istek");
  }
  await prisma.roadHazard.update({
    where: { id },
    data: { durum: durumRaw as HazardDurum },
  });
  revalidatePath("/harita");
}

export async function engelSil(formData: FormData) {
  await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");

  const photos = await prisma.roadHazardPhoto.findMany({
    where: { hazardId: id },
    select: { url: true },
  });
  await prisma.roadHazard.delete({ where: { id } });
  for (const p of photos) {
    await deleteHazardPhotoFile(p.url);
  }
  revalidatePath("/harita");
}
