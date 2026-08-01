import { z } from "zod";
import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import {
  canAccessComplaint,
  loadComplaintForAccess,
  loadVehicleForAccess,
  toAccessUser,
} from "@/lib/access";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  opsiyonelMetin as bosBoslukTemiz,
  opsiyonelSayi,
  rolGerekli,
  sayiAlani,
  ServiceError,
  type ServiceActor,
} from "@/lib/services/base";

export const sikayetInputSchema = z.object({
  arayanKisi: z.string().trim().min(1, "Arayan kişi zorunlu"),
  telefon: bosBoslukTemiz,
  neighborhoodId: bosBoslukTemiz,
  acikAdres: bosBoslukTemiz,
  complaintTypeId: bosBoslukTemiz,
  aciklama: bosBoslukTemiz,
  departmentId: bosBoslukTemiz,
  oncelik: z.enum(["NORMAL", "ACIL", "COK_ACIL"]).default("NORMAL"),
  vehicleId: bosBoslukTemiz,
  personnelIds: z.array(z.string().trim().min(1)).default([]),
  kanal: z.enum(["TELEFON", "WHATSAPP", "WEB"]).default("TELEFON"),
  /** Manuel harita pini — verilirse kayda yazılır */
  lat: opsiyonelSayi(z.number().min(-90).max(90)),
  lng: opsiyonelSayi(z.number().min(-180).max(180)),
});

export type SikayetInput = z.input<typeof sikayetInputSchema>;

export async function sikayetOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.complaints);
  const data = sikayetInputSchema.parse(input);

  // Tür seçilmiş ama müdürlük seçilmemişse: tür→müdürlük eşlemesi (Excel/AI yönlendirme kuralı)
  let departmentId = data.departmentId;
  if (!departmentId && data.complaintTypeId) {
    const tur = await prisma.complaintType.findUnique({
      where: { id: data.complaintTypeId },
    });
    departmentId = tur?.defaultDepartmentId ?? undefined;
  }

  personelAtamaYetkisi(actor, data.personnelIds);
  await gecerliPersonelleriGetir(actor, data.personnelIds);

  // Plaka seçildiyse şoför bilgisi araç zimmetinden gelir (Excel VLOOKUP davranışı)
  let soforAdi: string | undefined;
  let soforTelefonu: string | undefined;
  if (data.vehicleId) {
    await aracAtamaDogrula(actor, data.vehicleId);
    const arac = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      include: { atananSofor: true },
    });
    soforAdi = arac?.atananSofor?.name;
    soforTelefonu = arac?.atananSofor?.phone;
  }

  const manuelKonum =
    data.lat != null && data.lng != null
      ? { lat: data.lat, lng: data.lng }
      : null;

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    return tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: data.kanal,
        arayanKisi: data.arayanKisi,
        telefon: data.telefon,
        neighborhoodId: data.neighborhoodId,
        acikAdres: data.acikAdres,
        complaintTypeId: data.complaintTypeId,
        aciklama: data.aciklama,
        departmentId,
        oncelik: data.oncelik,
        vehicleId: data.vehicleId,
        soforAdi,
        soforTelefonu,
        ...(manuelKonum ?? {}),
        personel: {
          create: data.personnelIds.map((personnelId) => ({ personnelId })),
        },
        events: {
          create: {
            userId: actor.user.id,
            tip: "OLUSTURULDU",
            detay: {
              kanal: data.kanal,
              ...(manuelKonum
                ? { konum: { kaynak: "manuel", ...manuelKonum } }
                : {}),
            },
          },
        },
      },
    });
  });

  await auditKaydet(actor, "SIKAYET_OLUSTUR", {
    varlik: "Complaint",
    varlikId: created.id,
    detay: { sikayetNo: created.sikayetNo },
  });

  return created;
}

export const sikayetDurumInputSchema = z.object({
  durum: z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]),
  cozumNotu: bosBoslukTemiz,
  lat: sayiAlani(z.number().min(-90).max(90)).optional(),
  lng: sayiAlani(z.number().min(-180).max(180)).optional(),
});

export type SikayetDurumInput = z.input<typeof sikayetDurumInputSchema>;

export async function sikayetDurumGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.complaints);
  const data = sikayetDurumInputSchema.parse(input);

  const eski = await sikayetErisim(actor, id);

  const transition = canTransitionComplaint(eski.durum, data.durum, actor.user.role);
  if (!transition.ok) throw new ServiceError(transition.error, 409);

  const guncel = await prisma.complaint.update({
    where: { id },
    data: {
      durum: data.durum,
      ...(data.lat != null ? { lat: data.lat } : {}),
      ...(data.lng != null ? { lng: data.lng } : {}),
      ...(data.durum === "KAPATILDI"
        ? {
            kapanisTarihi: new Date(),
            cozumNotu: data.cozumNotu,
            onaylayanId: actor.user.id,
          }
        : {}),
      events: {
        create: {
          userId: actor.user.id,
          tip: "DURUM_DEGISTI",
          detay: { eski: eski.durum, yeni: data.durum, cozumNotu: data.cozumNotu },
        },
      },
    },
  });

  await auditKaydet(actor, "SIKAYET_DURUM_GUNCELLE", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: eski.sikayetNo, eski: eski.durum, yeni: data.durum },
  });

  return guncel;
}

export const mudurlukAtaInputSchema = z.object({
  departmentId: z.string().trim().min(1).nullable(),
});

export type MudurlukAtaInput = z.input<typeof mudurlukAtaInputSchema>;

export async function sikayetMudurlukAta(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.whatsapp); // ADMIN, CALL_CENTER
  const { departmentId } = mudurlukAtaInputSchema.parse(input);

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut) throw new ServiceError("Şikayet bulunamadı", 404);
  if (mevcut.departmentId === departmentId) return mevcut;

  const guncel = await prisma.complaint.update({
    where: { id },
    data: {
      departmentId,
      events: {
        create: {
          userId: actor.user.id,
          tip: "MUDURLUK_ATAMA",
          detay: { eski: mevcut.departmentId, yeni: departmentId },
        },
      },
    },
  });

  await auditKaydet(actor, "SIKAYET_MUDURLUK_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, departmentId },
  });

  if (departmentId) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== actor.user.id),
      {
        tip: "ATAMA",
        baslik: `${mevcut.sikayetNo} müdürlüğünüze yönlendirildi`,
        mesaj: `${actor.user.name} şikayeti müdürlüğünüze atadı.`,
        href: `/sikayetler/${id}`,
      },
    );
  }

  return guncel;
}

export const personelAtaInputSchema = z.object({
  personnelIds: z.array(z.string().trim().min(1)).min(1, "En az bir personel seçin"),
});

export type PersonelAtaInput = z.input<typeof personelAtaInputSchema>;

export async function sikayetPersonelAta(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ["ADMIN", "DEPARTMENT_MANAGER"]);
  const { personnelIds } = personelAtaInputSchema.parse(input);

  const mevcut = await sikayetErisim(actor, id);
  const personeller = await gecerliPersonelleriGetir(actor, personnelIds);

  await prisma.$transaction(async (tx) => {
    await tx.complaintPersonnel.createMany({
      data: personnelIds.map((personnelId) => ({ complaintId: id, personnelId })),
      skipDuplicates: true,
    });
    await tx.complaint.update({
      where: { id },
      data: {
        ...(mevcut.durum === "ACIK" ? { durum: "DEVAM_EDIYOR" as const } : {}),
        events: {
          create: {
            userId: actor.user.id,
            tip: "GOREVLENDIRME",
            detay: { personnelIds, personel: personeller.map((p) => p.adSoyad) },
          },
        },
      },
    });
  });

  await auditKaydet(actor, "SIKAYET_PERSONEL_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, personnelIds },
  });

  const personelUserIds = personeller
    .map((p) => p.userId)
    .filter((uid): uid is string => !!uid);
  await bildirimGonder(
    personelUserIds.filter((uid) => uid !== actor.user.id),
    {
      tip: "ATAMA",
      baslik: `${mevcut.sikayetNo} size atandı`,
      mesaj: `${actor.user.name} şikayeti size görevlendirdi.`,
      href: `/islerim`,
    },
  );

  return { ok: true as const };
}

export const sikayetAtaInputSchema = z.object({
  vehicleId: z.string().trim().min(1).nullable().optional(),
  personnelIds: z.array(z.string().trim().min(1)).default([]),
});

export type SikayetAtaInput = z.input<typeof sikayetAtaInputSchema>;

/** Araç + personel atamasını topluca değiştirir (mevcut personel listesi sıfırlanır). */
export async function sikayetAta(actor: ServiceActor, id: string, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.complaints);
  const data = sikayetAtaInputSchema.parse(input);
  const vehicleId = data.vehicleId ?? null;

  const mevcut = await sikayetErisim(actor, id);

  personelAtamaYetkisi(actor, data.personnelIds);
  await gecerliPersonelleriGetir(actor, data.personnelIds);

  let soforAdi: string | null = null;
  let soforTelefonu: string | null = null;
  let soforUserId: string | null = null;
  if (vehicleId) {
    await aracAtamaDogrula(actor, vehicleId);
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
        personel: {
          create: data.personnelIds.map((personnelId) => ({ personnelId })),
        },
        events: {
          create: {
            userId: actor.user.id,
            tip: "GOREVLENDIRME",
            detay: { vehicleId, personnelIds: data.personnelIds },
          },
        },
      },
    });
  });

  await auditKaydet(actor, "SIKAYET_ATA", {
    varlik: "Complaint",
    varlikId: id,
    detay: {
      sikayetNo: mevcut.sikayetNo,
      vehicleId,
      personnelIds: data.personnelIds,
    },
  });

  const yoneticiler = mevcut.departmentId
    ? await kullaniciIdleri(["DEPARTMENT_MANAGER"], mevcut.departmentId)
    : [];
  await bildirimGonder(
    [...yoneticiler, ...(soforUserId ? [soforUserId] : [])].filter(
      (uid) => uid !== actor.user.id,
    ),
    {
      tip: "ATAMA",
      baslik: `${mevcut.sikayetNo} görevlendirildi`,
      mesaj: `${actor.user.name} şikayete araç/personel ataması yaptı.`,
      href: `/sikayetler/${id}`,
    },
  );

  return { ok: true as const };
}

export const sikayetKonumInputSchema = z.object({
  lat: sayiAlani(z.number().min(-90).max(90)),
  lng: sayiAlani(z.number().min(-180).max(180)),
});

export type SikayetKonumInput = z.input<typeof sikayetKonumInputSchema>;

/** Panelden manuel pin veya Adresten bul sonucu — AI geocode'unu ezer. */
export async function sikayetKonumGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.complaints);
  const data = sikayetKonumInputSchema.parse(input);
  const mevcut = await sikayetErisim(actor, id);

  const guncel = await prisma.complaint.update({
    where: { id },
    data: {
      lat: data.lat,
      lng: data.lng,
      events: {
        create: {
          userId: actor.user.id,
          tip: "KONUM_GUNCELLENDI",
          detay: {
            kaynak: "manuel",
            lat: data.lat,
            lng: data.lng,
            eski: { lat: mevcut.lat, lng: mevcut.lng },
          },
        },
      },
    },
  });

  await auditKaydet(actor, "SIKAYET_KONUM_GUNCELLE", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: mevcut.sikayetNo, lat: data.lat, lng: data.lng },
  });

  return guncel;
}

// ── Ortak doğrulamalar ───────────────────────────────────────────────────────

async function sikayetErisim(actor: ServiceActor, id: string) {
  const row = await loadComplaintForAccess(id);
  if (!row) throw new ServiceError("Şikayet bulunamadı", 404);
  if (!canAccessComplaint(toAccessUser(actor.user), row)) {
    throw new ServiceError("Yetkisiz", 403);
  }
  return row;
}

/** Personel ataması müdürlük bağlamı gerektirir; çağrı merkezi yalnız araç atar. */
function personelAtamaYetkisi(actor: ServiceActor, personnelIds: string[]): void {
  if (personnelIds.length === 0) return;
  if (actor.user.role !== "ADMIN" && actor.user.role !== "DEPARTMENT_MANAGER") {
    throw new ServiceError("Personel atama yetkiniz yok", 403);
  }
}

/**
 * Şikayete araç atanabilirliği: müdür yalnızca kendi müdürlüğünün aracını
 * atayabilir (ADMIN/CALL_CENTER/APPROVER kurum genelinde çalışır).
 */
async function aracAtamaDogrula(actor: ServiceActor, vehicleId: string) {
  const arac = await loadVehicleForAccess(vehicleId);
  if (!arac) throw new ServiceError("Araç bulunamadı", 404);
  if (
    actor.user.role === "DEPARTMENT_MANAGER" &&
    arac.departmentId !== actor.user.departmentId
  ) {
    throw new ServiceError("Seçilen araç müdürlüğünüze bağlı değil", 403);
  }
  return arac;
}

/**
 * Atanabilir personelleri doğrular: hepsi AKTIF olmalı, müdür yalnızca kendi
 * müdürlüğündeki personeli atayabilir. Eksik/yetkisiz id varsa hata fırlatır.
 */
async function gecerliPersonelleriGetir(actor: ServiceActor, personnelIds: string[]) {
  if (personnelIds.length === 0) return [];
  const personeller = await prisma.personnel.findMany({
    where: {
      id: { in: personnelIds },
      durum: "AKTIF",
      ...(actor.user.role === "DEPARTMENT_MANAGER"
        ? { departmentId: actor.user.departmentId ?? "-" }
        : {}),
    },
    select: { id: true, adSoyad: true, userId: true },
  });
  if (personeller.length !== new Set(personnelIds).size) {
    throw new ServiceError(
      "Seçilen personel bulunamadı veya müdürlüğünüze bağlı değil",
      403,
    );
  }
  return personeller;
}
