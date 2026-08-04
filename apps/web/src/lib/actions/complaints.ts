"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import {
  canAccessComplaint,
  loadComplaintForAccess,
  loadVehicleForAccess,
  toAccessUser,
} from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  actionBasarili,
  actionHatasi,
  type ActionState,
} from "@/lib/action-state";
import {
  cleanupComplaintPhotoFiles,
  saveComplaintPhotosFromForm,
} from "@/lib/complaint-photos";

const opsiyonelKoordinat = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  })
  .optional();

const yeniSikayetSchema = z.object({
  arayanKisi: z.string().min(1, "Arayan kişi zorunlu"),
  telefon: z.string().optional(),
  neighborhoodId: z.string().optional(),
  acikAdres: z.string().optional(),
  complaintTypeId: z.string().optional(),
  aciklama: z.string().optional(),
  departmentId: z.string().optional(),
  oncelik: z.enum(["NORMAL", "ACIL", "COK_ACIL"]).default("NORMAL"),
  vehicleId: z.string().optional(),
  personnelIds: z.array(z.string()).default([]),
  kanal: z.enum(["TELEFON", "WHATSAPP", "WEB"]).default("TELEFON"),
  lat: opsiyonelKoordinat.pipe(z.number().min(-90).max(90).optional()),
  lng: opsiyonelKoordinat.pipe(z.number().min(-180).max(180).optional()),
});

export async function sikayetOlustur(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetOlusturGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetOlusturGovde(formData: FormData): Promise<ActionState> {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const parsed = yeniSikayetSchema.parse({
    arayanKisi: formData.get("arayanKisi"),
    telefon: formData.get("telefon") || undefined,
    neighborhoodId: formData.get("neighborhoodId") || undefined,
    acikAdres: formData.get("acikAdres") || undefined,
    complaintTypeId: formData.get("complaintTypeId") || undefined,
    aciklama: formData.get("aciklama") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    oncelik: formData.get("oncelik") || "NORMAL",
    vehicleId: formData.get("vehicleId") || undefined,
    personnelIds: formData.getAll("personnelIds").map(String).filter(Boolean),
    kanal: "TELEFON",
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
  });

  // Tür seçilmiş ama müdürlük seçilmemişse: tür→müdürlük eşlemesi (Excel/AI yönlendirme kuralı)
  let departmentId = parsed.departmentId;
  if (!departmentId && parsed.complaintTypeId) {
    const tur = await prisma.complaintType.findUnique({
      where: { id: parsed.complaintTypeId },
    });
    departmentId = tur?.defaultDepartmentId ?? undefined;
  }

  if (
    parsed.personnelIds.length > 0 &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "DEPARTMENT_MANAGER"
  ) {
    throw new Error("Personel atama yetkiniz yok");
  }
  await gecerliPersonelleriGetir(session.user, parsed.personnelIds);

  // Plaka seçildiyse şoför bilgisi araç zimmetinden gelir (Excel VLOOKUP davranışı)
  let soforAdi: string | undefined;
  let soforTelefonu: string | undefined;
  if (parsed.vehicleId) {
    await aracAtamaDogrula(session.user, parsed.vehicleId);
    const arac = await prisma.vehicle.findUnique({
      where: { id: parsed.vehicleId },
      include: { atananSofor: true },
    });
    soforAdi = arac?.atananSofor?.name;
    soforTelefonu = arac?.atananSofor?.phone;
  }

  const manuelKonum =
    parsed.lat != null && parsed.lng != null
      ? { lat: parsed.lat, lng: parsed.lng }
      : null;

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    return tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: parsed.kanal,
        arayanKisi: parsed.arayanKisi,
        telefon: parsed.telefon,
        neighborhoodId: parsed.neighborhoodId,
        acikAdres: parsed.acikAdres,
        complaintTypeId: parsed.complaintTypeId,
        aciklama: parsed.aciklama,
        departmentId,
        oncelik: parsed.oncelik,
        vehicleId: parsed.vehicleId,
        soforAdi,
        soforTelefonu,
        ...(manuelKonum ?? {}),
        personel: {
          create: parsed.personnelIds.map((personnelId) => ({ personnelId })),
        },
        events: {
          create: {
            userId: session.user.id,
            tip: "OLUSTURULDU",
            detay: {
              kanal: parsed.kanal,
              ...(manuelKonum
                ? { konum: { kaynak: "manuel", ...manuelKonum } }
                : {}),
            },
          },
        },
      },
    });
  });

  await auditKaydet(session, "SIKAYET_OLUSTUR", {
    varlik: "Complaint",
    varlikId: created.id,
    detay: { sikayetNo: created.sikayetNo },
  });

  revalidatePath("/sikayetler");
  redirect(`/sikayetler/${created.id}`);
}

const durumSchema = z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]);

export async function sikayetDurumGuncelle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetDurumGuncelleGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetDurumGuncelleGovde(
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const id = String(formData.get("id"));
  const durum = durumSchema.parse(formData.get("durum"));
  const cozumNotu = (formData.get("cozumNotu") as string) || undefined;

  const eski = await loadComplaintForAccess(id);
  if (!eski || !canAccessComplaint(toAccessUser(session.user), eski)) {
    throw new Error("Yetkisiz");
  }

  const transition = canTransitionComplaint(eski.durum, durum, session.user.role);
  if (!transition.ok) throw new Error(transition.error);

  const cozumFotolari =
    durum === "KAPATILDI"
      ? await saveComplaintPhotosFromForm(formData, "cozumFotolari")
      : [];

  try {
    await prisma.complaint.update({
      where: { id },
      data: {
        durum,
        ...(durum === "KAPATILDI"
          ? {
              kapanisTarihi: new Date(),
              cozumNotu,
              onaylayanId: session.user.id,
              ...(cozumFotolari.length > 0
                ? {
                    photos: {
                      create: cozumFotolari.map((url) => ({
                        url,
                        tip: "COZUM",
                      })),
                    },
                  }
                : {}),
            }
          : {}),
        events: {
          create: {
            userId: session.user.id,
            tip: "DURUM_DEGISTI",
            detay: {
              eski: eski.durum,
              yeni: durum,
              cozumNotu,
              fotoAdet: cozumFotolari.length,
            },
          },
        },
      },
    });
  } catch (e) {
    await cleanupComplaintPhotoFiles(cozumFotolari);
    throw e;
  }

  await auditKaydet(session, "SIKAYET_DURUM_GUNCELLE", {
    varlik: "Complaint",
    varlikId: id,
    detay: {
      sikayetNo: eski.sikayetNo,
      eski: eski.durum,
      yeni: durum,
      fotoAdet: cozumFotolari.length,
    },
  });

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
  revalidatePath("/");

  return actionBasarili(
    durum === "KAPATILDI" ? "Şikayet kapatıldı" : "Durum güncellendi",
  );
}

export async function sikayetMudurlukAta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetMudurlukAtaGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetMudurlukAtaGovde(
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRoles(ACTION_ROLES.whatsapp); // ADMIN, CALL_CENTER

  const id = String(formData.get("id"));
  const departmentId = (formData.get("departmentId") as string) || null;

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut) throw new Error("Şikayet bulunamadı");
  if (mevcut.departmentId === departmentId) {
    return actionBasarili("Müdürlük zaten seçili");
  }

  await prisma.complaint.update({
    where: { id },
    data: {
      departmentId,
      events: {
        create: {
          userId: session.user.id,
          tip: "MUDURLUK_ATAMA",
          detay: { eski: mevcut.departmentId, yeni: departmentId },
        },
      },
    },
  });

  await auditKaydet(session, "SIKAYET_MUDURLUK_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, departmentId },
  });

  if (departmentId) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "ATAMA",
        baslik: `${mevcut.sikayetNo} müdürlüğünüze yönlendirildi`,
        mesaj: `${session.user.name} şikayeti müdürlüğünüze atadı.`,
        href: `/sikayetler/${id}`,
      },
    );
  }

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");

  return actionBasarili(
    departmentId ? "Müdürlüğe yönlendirildi" : "Müdürlük kaldırıldı",
  );
}

/**
 * Şikayete araç atanabilirliği: müdür yalnızca kendi müdürlüğünün aracını
 * atayabilir (ADMIN/CALL_CENTER/APPROVER kurum genelinde çalışır).
 */
async function aracAtamaDogrula(
  user: { role: string; departmentId: string | null },
  vehicleId: string,
) {
  const arac = await loadVehicleForAccess(vehicleId);
  if (!arac) throw new Error("Araç bulunamadı");
  if (user.role === "DEPARTMENT_MANAGER" && arac.departmentId !== user.departmentId) {
    throw new Error("Seçilen araç müdürlüğünüze bağlı değil");
  }
  return arac;
}

/**
 * Atanabilir personelleri doğrular: hepsi AKTIF olmalı, müdür yalnızca kendi
 * müdürlüğündeki personeli atayabilir. Eksik/yetkisiz id varsa hata fırlatır.
 */
async function gecerliPersonelleriGetir(
  user: { role: string; departmentId: string | null },
  personnelIds: string[],
) {
  if (personnelIds.length === 0) return [];
  const personeller = await prisma.personnel.findMany({
    where: {
      id: { in: personnelIds },
      durum: "AKTIF",
      ...(user.role === "DEPARTMENT_MANAGER"
        ? { departmentId: user.departmentId ?? "-" }
        : {}),
    },
    select: { id: true, adSoyad: true, userId: true },
  });
  if (personeller.length !== new Set(personnelIds).size) {
    throw new Error("Seçilen personel bulunamadı veya müdürlüğünüze bağlı değil");
  }
  return personeller;
}

export async function sikayetPersonelAta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetPersonelAtaGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetPersonelAtaGovde(
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRoles(["ADMIN", "DEPARTMENT_MANAGER"]);

  const id = String(formData.get("id"));
  const personnelIds = formData.getAll("personnelIds").map(String).filter(Boolean);
  if (personnelIds.length === 0) throw new Error("En az bir personel seçin");

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut || !canAccessComplaint(toAccessUser(session.user), mevcut)) {
    throw new Error("Yetkisiz");
  }

  const personeller = await gecerliPersonelleriGetir(session.user, personnelIds);

  await prisma.$transaction(async (tx) => {
    await tx.complaintPersonnel.createMany({
      data: personnelIds.map((personnelId) => ({ complaintId: id, personnelId })),
      skipDuplicates: true,
    });
    await tx.complaint.update({
      where: { id },
      data: {
        ...(mevcut.durum === "ACIK" ? { durum: "DEVAM_EDIYOR" } : {}),
        events: {
          create: {
            userId: session.user.id,
            tip: "GOREVLENDIRME",
            detay: { personnelIds, personel: personeller.map((p) => p.adSoyad) },
          },
        },
      },
    });
  });

  await auditKaydet(session, "SIKAYET_PERSONEL_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, personnelIds },
  });

  const personelUserIds = personeller
    .map((p) => p.userId)
    .filter((uid): uid is string => !!uid);
  await bildirimGonder(
    personelUserIds.filter((uid) => uid !== session.user.id),
    {
      tip: "ATAMA",
      baslik: `${mevcut.sikayetNo} size atandı`,
      mesaj: `${session.user.name} şikayeti size görevlendirdi.`,
      href: `/islerim`,
    },
  );

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
  revalidatePath("/islerim");

  return actionBasarili(
    `${personeller.length} personel görevlendirildi`,
  );
}

export async function sikayetAta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetAtaGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetAtaGovde(formData: FormData): Promise<ActionState> {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const id = String(formData.get("id"));
  const vehicleId = (formData.get("vehicleId") as string) || null;
  const personnelIds = formData.getAll("personnelIds").map(String).filter(Boolean);

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut || !canAccessComplaint(toAccessUser(session.user), mevcut)) {
    throw new Error("Yetkisiz");
  }

  // Personel ataması müdürlük bağlamı gerektirir; çağrı merkezi yalnız araç atar
  if (
    personnelIds.length > 0 &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "DEPARTMENT_MANAGER"
  ) {
    throw new Error("Personel atama yetkiniz yok");
  }
  await gecerliPersonelleriGetir(session.user, personnelIds);

  let soforAdi: string | null = null;
  let soforTelefonu: string | null = null;
  let soforUserId: string | null = null;
  if (vehicleId) {
    await aracAtamaDogrula(session.user, vehicleId);
    const arac = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { atananSofor: true },
    });
    soforAdi = arac?.atananSofor?.name ?? null;
    soforTelefonu = arac?.atananSofor?.phone ?? null;
    soforUserId = arac?.atananSofor?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.complaintPersonnel.deleteMany({ where: { complaintId: id } });
    await tx.complaint.update({
      where: { id },
      data: {
        vehicleId,
        soforAdi,
        soforTelefonu,
        durum: "DEVAM_EDIYOR",
        personel: { create: personnelIds.map((personnelId) => ({ personnelId })) },
        events: {
          create: {
            userId: session.user.id,
            tip: "GOREVLENDIRME",
            detay: { vehicleId, personnelIds },
          },
        },
      },
    });
  });

  await auditKaydet(session, "SIKAYET_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, vehicleId, personnelIds },
  });

  const yoneticiler = mevcut.departmentId
    ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], mevcut.departmentId)
    : [];
  await bildirimGonder(
    [...yoneticiler, ...(soforUserId ? [soforUserId] : [])].filter(
      (uid) => uid !== session.user.id,
    ),
    {
      tip: "ATAMA",
      baslik: `${mevcut.sikayetNo} görevlendirildi`,
      mesaj: `${session.user.name} şikayete araç/personel ataması yaptı.`,
      href: `/sikayetler/${id}`,
    },
  );

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");

  return actionBasarili("Görevlendirme kaydedildi");
}

const konumSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Panel haritasından veya Adresten bul ile konum kaydı. */
export async function sikayetKonumGuncelle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await sikayetKonumGuncelleGovde(formData);
  } catch (e) {
    return actionHatasi(e, formData);
  }
}

async function sikayetKonumGuncelleGovde(
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRoles(ACTION_ROLES.complaints);
  const id = String(formData.get("id"));
  const { lat, lng } = konumSchema.parse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut || !canAccessComplaint(toAccessUser(session.user), mevcut)) {
    throw new Error("Yetkisiz");
  }

  await prisma.complaint.update({
    where: { id },
    data: {
      lat,
      lng,
      events: {
        create: {
          userId: session.user.id,
          tip: "KONUM_GUNCELLENDI",
          detay: {
            kaynak: "manuel",
            lat,
            lng,
            eski: { lat: mevcut.lat, lng: mevcut.lng },
          },
        },
      },
    },
  });

  await auditKaydet(session, "SIKAYET_KONUM_GUNCELLE", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, lat, lng },
  });

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
  revalidatePath("/");
  revalidatePath("/harita");

  return actionBasarili("Konum kaydedildi");
}

/** Client "Adresten bul" — Nominatim; pin alanlarını doldurur, kaydetmez. */
export async function adresGeocodeEt(girdi: {
  adres?: string;
  mahalle?: string;
}): Promise<{ lat: number; lng: number; displayName: string } | null> {
  await requireRoles(ACTION_ROLES.complaints);
  const { geocodeKarsAdres } = await import("@kars/shared");
  return geocodeKarsAdres({
    adres: girdi.adres,
    mahalle: girdi.mahalle,
  });
}
