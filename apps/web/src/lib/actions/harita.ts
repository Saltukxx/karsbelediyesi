"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import type { AsfaltDurum, HazardDurum, HazardTip } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
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

/** Müdürlük değiştiyse yeni müdürlüğün yöneticilerine bildirim gönderir */
async function asfaltMudurlukBildir(
  session: Awaited<ReturnType<typeof requireRoles>>,
  roadAd: string,
  departmentId: string,
) {
  const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], departmentId);
  await bildirimGonder(
    yoneticiler.filter((uid) => uid !== session.user.id),
    {
      tip: "ATAMA",
      baslik: "Asfalt rotası müdürlüğünüze atandı",
      mesaj: `${session.user.name} "${roadAd}" rotasını müdürlüğünüze atadı.`,
      href: "/harita",
    },
  );
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
  const departmentId = bos(formData.get("departmentId"));

  await prisma.asphaltRoad.create({
    data: {
      ad,
      koordinatlar,
      durum,
      dokumTarihi: dokumTarihi ? new Date(dokumTarihi) : undefined,
      notlar: bos(formData.get("notlar")),
      departmentId,
      createdById: session.user.id,
    },
  });
  if (departmentId) {
    await asfaltMudurlukBildir(session, ad, departmentId);
  }
  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltYolGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const ad = bos(formData.get("ad"));
  const durumRaw = bos(formData.get("durum"));
  const dokumTarihi = bos(formData.get("dokumTarihi"));
  const koordinatlarRaw = bos(formData.get("koordinatlar"));
  const departmentId = bos(formData.get("departmentId")) ?? null;

  const eski = await prisma.asphaltRoad.findUnique({
    where: { id },
    select: { departmentId: true },
  });

  const guncel = await prisma.asphaltRoad.update({
    where: { id },
    data: {
      ad,
      koordinatlar: koordinatlarRaw ? parseKoordinatlar(koordinatlarRaw) : undefined,
      durum: ASFALT_DURUMLAR.includes(durumRaw as AsfaltDurum)
        ? (durumRaw as AsfaltDurum)
        : undefined,
      dokumTarihi: dokumTarihi ? new Date(dokumTarihi) : undefined,
      notlar: bos(formData.get("notlar")) ?? null,
      departmentId,
    },
  });
  if (departmentId && departmentId !== eski?.departmentId) {
    await asfaltMudurlukBildir(session, guncel.ad, departmentId);
  }
  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltPersonelAta(formData: FormData) {
  const session = await requireRoles(["ADMIN", "DEPARTMENT_MANAGER"]);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const personnelIds = formData.getAll("personnelIds").map(String).filter(Boolean);

  const road = await prisma.asphaltRoad.findUnique({
    where: { id },
    select: { id: true, ad: true, departmentId: true },
  });
  if (!road) throw new Error("Kayıt bulunamadı");
  if (
    session.user.role === "DEPARTMENT_MANAGER" &&
    (!session.user.departmentId || road.departmentId !== session.user.departmentId)
  ) {
    throw new Error("Bu rota müdürlüğünüze atanmamış");
  }

  // Müdür yalnızca kendi müdürlüğündeki aktif personeli atayabilir
  const personeller = await prisma.personnel.findMany({
    where: {
      id: { in: personnelIds },
      durum: "AKTIF",
      ...(session.user.role === "DEPARTMENT_MANAGER"
        ? { departmentId: session.user.departmentId ?? "-" }
        : {}),
    },
    select: { id: true, adSoyad: true, userId: true },
  });
  if (personeller.length !== personnelIds.length) {
    throw new Error("Seçilen personel bulunamadı veya müdürlüğünüze bağlı değil");
  }

  await prisma.$transaction(async (tx) => {
    await tx.asphaltRoadPersonnel.deleteMany({ where: { asphaltRoadId: id } });
    if (personnelIds.length > 0) {
      await tx.asphaltRoadPersonnel.createMany({
        data: personnelIds.map((personnelId) => ({ asphaltRoadId: id, personnelId })),
      });
    }
  });

  await auditKaydet(session, "ASFALT_PERSONEL_ATA", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: road.ad, personnelIds },
  });

  const personelUserIds = personeller
    .map((p) => p.userId)
    .filter((uid): uid is string => !!uid);
  await bildirimGonder(
    personelUserIds.filter((uid) => uid !== session.user.id),
    {
      tip: "ATAMA",
      baslik: `"${road.ad}" asfalt rotası size atandı`,
      mesaj: `${session.user.name} sizi bu rotada görevlendirdi.`,
      href: "/islerim",
    },
  );

  revalidatePath("/harita");
  revalidatePath("/islerim");
}

export async function asfaltYolSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.harita);

  const id = bos(formData.get("id"));
  if (!id) throw new Error("Kayıt bulunamadı");
  const silinen = await prisma.asphaltRoad.delete({ where: { id } });
  await auditKaydet(session, "ASFALT_YOL_SIL", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: silinen.ad },
  });
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

  const engel = await prisma.roadHazard.create({
    data: {
      tip,
      lat,
      lng,
      aciklama: bos(formData.get("aciklama")),
      createdById: session.user.id,
      photos: { create: savedNames.map((url) => ({ url })) },
    },
  });

  await auditKaydet(session, "ENGEL_KAYDET", {
    varlik: "RoadHazard",
    varlikId: engel.id,
    detay: { tip, lat, lng },
  });
  const ilgililer = await kullaniciIdleri(["ADMIN", "DEPARTMENT_MANAGER"]);
  await bildirimGonder(
    ilgililer.filter((uid) => uid !== session.user.id),
    {
      tip: "SISTEM",
      baslik: "Haritaya yeni engel/çukur işaretlendi",
      mesaj: `${session.user.name} yeni bir nokta ekledi.`,
      href: "/harita",
    },
  );

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
  const session = await requireRoles(ACTION_ROLES.harita);

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
  await auditKaydet(session, "ENGEL_SIL", {
    varlik: "RoadHazard",
    varlikId: id,
  });
  revalidatePath("/harita");
}
