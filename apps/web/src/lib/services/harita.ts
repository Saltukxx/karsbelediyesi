import { z } from "zod";
import { AsfaltDurum, HazardDurum, HazardTip, prisma } from "@kars/db";
import { SIKAYET_DURUM_LABELS } from "@kars/shared";
import { iso } from "@/lib/api/serialize";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  deleteHazardPhotoFile,
  isAllowedPhotoMime,
  MAX_PHOTO_BYTES,
  saveHazardPhoto,
} from "@/lib/hazard-photos";
import { KONUM_TAZELIK_MS } from "@/lib/location";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  alanGonderildi,
  bulunamadi,
  enumAlani,
  opsiyonelMetin,
  opsiyonelTarih,
  rolGerekli,
  sayiAlani,
  ServiceError,
  zorunluMetin,
  type ServiceActor,
} from "@/lib/services/base";
import { koordinatlarAlani } from "@/lib/services/rota-ortak";

// ── Asfalt yollar ────────────────────────────────────────────────────────────

export const asfaltYolInputSchema = z.object({
  ad: zorunluMetin("Yol adı gerekli"),
  koordinatlar: koordinatlarAlani,
  durum: enumAlani(AsfaltDurum, AsfaltDurum.TAMAMLANDI),
  dokumTarihi: opsiyonelTarih(),
  departmentId: opsiyonelMetin,
  notlar: opsiyonelMetin,
});

export type AsfaltYolInput = z.input<typeof asfaltYolInputSchema>;

/** Güncellemede yalnız gönderilen alanlar değişir; koordinat isteğe bağlıdır. */
export const asfaltYolGuncelleInputSchema = asfaltYolInputSchema.partial().extend({
  durum: enumAlani(AsfaltDurum, AsfaltDurum.TAMAMLANDI).optional(),
});

export type AsfaltYolGuncelleInput = z.input<typeof asfaltYolGuncelleInputSchema>;

export async function asfaltYolOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.harita);
  const data = asfaltYolInputSchema.parse(input);

  const yol = await prisma.asphaltRoad.create({
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      durum: data.durum,
      dokumTarihi: data.dokumTarihi,
      notlar: data.notlar,
      departmentId: data.departmentId,
      createdById: actor.user.id,
    },
  });

  await auditKaydet(actor, "ASFALT_YOL_OLUSTUR", {
    varlik: "AsphaltRoad",
    varlikId: yol.id,
    detay: { ad: yol.ad },
  });
  if (data.departmentId) {
    await asfaltMudurlukBildir(actor, yol.ad, data.departmentId);
  }

  return serializeYol(yol);
}

export async function asfaltYolGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.harita);
  const data = asfaltYolGuncelleInputSchema.parse(input);

  const eski = await prisma.asphaltRoad.findUnique({
    where: { id },
    select: { id: true, departmentId: true },
  });
  if (!eski) bulunamadi("Asfalt rotası");

  const guncel = await prisma.asphaltRoad.update({
    where: { id },
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      durum: data.durum,
      dokumTarihi: data.dokumTarihi,
      // Gönderilip boş bırakılan alanlar temizlenir (web formunun davranışı);
      // hiç gönderilmeyen alanlar dokunulmadan kalır.
      notlar: alanGonderildi(input, "notlar") ? (data.notlar ?? null) : undefined,
      departmentId: alanGonderildi(input, "departmentId")
        ? (data.departmentId ?? null)
        : undefined,
    },
  });

  await auditKaydet(actor, "ASFALT_YOL_GUNCELLE", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: guncel.ad },
  });
  if (data.departmentId && data.departmentId !== eski.departmentId) {
    await asfaltMudurlukBildir(actor, guncel.ad, data.departmentId);
  }

  return serializeYol(guncel);
}

export async function asfaltYolSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.harita);

  const mevcut = await prisma.asphaltRoad.findUnique({
    where: { id },
    select: { id: true, ad: true },
  });
  if (!mevcut) bulunamadi("Asfalt rotası");

  await prisma.asphaltRoad.delete({ where: { id } });
  await auditKaydet(actor, "ASFALT_YOL_SIL", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: mevcut.ad },
  });

  return { id, ad: mevcut.ad };
}

export const asfaltPersonelInputSchema = z.object({
  personnelIds: z.array(z.string().trim().min(1)).default([]),
});

export type AsfaltPersonelInput = z.input<typeof asfaltPersonelInputSchema>;

/**
 * Rota personeli tümüyle yeniden yazılır (web'in çoklu seçim formu). Müdür
 * yalnızca kendi müdürlüğüne atanmış rotaya ve kendi personeline dokunabilir.
 */
export async function asfaltPersonelAta(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ["ADMIN", "DEPARTMENT_MANAGER"]);
  const { personnelIds } = asfaltPersonelInputSchema.parse(input);

  const road = await prisma.asphaltRoad.findUnique({
    where: { id },
    select: { id: true, ad: true, departmentId: true },
  });
  if (!road) bulunamadi("Asfalt rotası");

  const mudur = actor.user.role === "DEPARTMENT_MANAGER";
  if (mudur && (!actor.user.departmentId || road.departmentId !== actor.user.departmentId)) {
    throw new ServiceError("Bu rota müdürlüğünüze atanmamış", 403);
  }

  const personeller = await prisma.personnel.findMany({
    where: {
      id: { in: personnelIds },
      durum: "AKTIF",
      ...(mudur ? { departmentId: actor.user.departmentId ?? "-" } : {}),
    },
    select: { id: true, adSoyad: true, userId: true },
  });
  if (personeller.length !== personnelIds.length) {
    throw new ServiceError(
      "Seçilen personel bulunamadı veya müdürlüğünüze bağlı değil",
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.asphaltRoadPersonnel.deleteMany({ where: { asphaltRoadId: id } });
    if (personnelIds.length > 0) {
      await tx.asphaltRoadPersonnel.createMany({
        data: personnelIds.map((personnelId) => ({ asphaltRoadId: id, personnelId })),
      });
    }
  });

  await auditKaydet(actor, "ASFALT_PERSONEL_ATA", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: road.ad, personnelIds },
  });

  const personelUserIds = personeller
    .map((p) => p.userId)
    .filter((uid): uid is string => !!uid);
  await bildirimGonder(
    personelUserIds.filter((uid) => uid !== actor.user.id),
    {
      tip: "ATAMA",
      baslik: `"${road.ad}" asfalt rotası size atandı`,
      mesaj: `${actor.user.name} sizi bu rotada görevlendirdi.`,
      href: "/islerim",
    },
  );

  return {
    id,
    personel: personeller.map((p) => ({ id: p.id, adSoyad: p.adSoyad })),
  };
}

// ── Engeller ─────────────────────────────────────────────────────────────────

export const engelInputSchema = z.object({
  lat: sayiAlani(z.number().finite().min(-90).max(90)),
  lng: sayiAlani(z.number().finite().min(-180).max(180)),
  tip: enumAlani(HazardTip, HazardTip.CUKUR),
  aciklama: opsiyonelMetin,
});

export type EngelInput = z.input<typeof engelInputSchema>;

/**
 * Fotoğraflar çağıran tarafta `File` olarak toplanır (multipart route veya
 * Server Action); doğrulama ve diske yazma burada yapılır.
 */
export async function engelOlustur(
  actor: ServiceActor,
  input: unknown,
  photos: File[] = [],
) {
  rolGerekli(actor, ACTION_ROLES.harita);
  const data = engelInputSchema.parse(input);

  for (const foto of photos) {
    if (!isAllowedPhotoMime(foto.type)) {
      throw new ServiceError("Sadece JPEG/PNG/WebP fotoğraf yüklenebilir", 415);
    }
    if (foto.size > MAX_PHOTO_BYTES) {
      throw new ServiceError("Fotoğraf en fazla 8 MB olabilir", 413);
    }
  }

  const savedNames: string[] = [];
  for (const foto of photos) {
    savedNames.push(await saveHazardPhoto(foto));
  }

  const engel = await prisma.roadHazard.create({
    data: {
      tip: data.tip,
      lat: data.lat,
      lng: data.lng,
      aciklama: data.aciklama,
      createdById: actor.user.id,
      photos: { create: savedNames.map((url) => ({ url })) },
    },
    include: { photos: { select: { id: true } } },
  });

  await auditKaydet(actor, "ENGEL_KAYDET", {
    varlik: "RoadHazard",
    varlikId: engel.id,
    detay: { tip: data.tip, lat: data.lat, lng: data.lng },
  });
  const ilgililer = await kullaniciIdleri(["ADMIN", "DEPARTMENT_MANAGER"]);
  await bildirimGonder(
    ilgililer.filter((uid) => uid !== actor.user.id),
    {
      tip: "SISTEM",
      baslik: "Haritaya yeni engel/çukur işaretlendi",
      mesaj: `${actor.user.name} yeni bir nokta ekledi.`,
      href: "/harita",
    },
  );

  return {
    id: engel.id,
    tip: engel.tip,
    lat: engel.lat,
    lng: engel.lng,
    aciklama: engel.aciklama,
    durum: engel.durum,
    photoIds: engel.photos.map((p) => p.id),
  };
}

export const engelDurumInputSchema = z.object({
  durum: z.nativeEnum(HazardDurum),
});

export type EngelDurumInput = z.input<typeof engelDurumInputSchema>;

export async function engelDurumGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.harita);
  const { durum } = engelDurumInputSchema.parse(input);

  const mevcut = await prisma.roadHazard.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Engel kaydı");

  const engel = await prisma.roadHazard.update({ where: { id }, data: { durum } });
  return { id: engel.id, durum: engel.durum };
}

export async function engelSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.harita);

  const mevcut = await prisma.roadHazard.findUnique({
    where: { id },
    select: { id: true, photos: { select: { url: true } } },
  });
  if (!mevcut) bulunamadi("Engel kaydı");

  await prisma.roadHazard.delete({ where: { id } });
  for (const foto of mevcut.photos) {
    await deleteHazardPhotoFile(foto.url);
  }
  await auditKaydet(actor, "ENGEL_SIL", { varlik: "RoadHazard", varlikId: id });

  return { id };
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/**
 * Harita ekranının tüm katmanları tek yanıtta: asfalt yollar, engeller,
 * konumu bilinen şikayetler ve son 15 dakikada ping atmış araçlar.
 * Düzenleme seçenekleri (müdürlük/personel) yalnız yetkili rollere döner.
 */
export async function haritaKatmanlari(actor: ServiceActor) {
  const rol = actor.user.role;
  const duzenleyebilir = ACTION_ROLES.harita.includes(rol);
  const personelAtayabilir =
    rol === "ADMIN" || (rol === "DEPARTMENT_MANAGER" && !!actor.user.departmentId);

  const [yollar, engeller, sikayetler, araclar, mudurlukler, personeller] =
    await Promise.all([
      prisma.asphaltRoad.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
          department: { select: { name: true } },
          personel: { include: { personnel: { select: { id: true, adSoyad: true } } } },
        },
      }),
      prisma.roadHazard.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
          photos: { select: { id: true } },
        },
      }),
      prisma.complaint.findMany({
        where: { lat: { not: null }, lng: { not: null } },
        select: {
          id: true,
          sikayetNo: true,
          durum: true,
          lat: true,
          lng: true,
          aciklama: true,
        },
      }),
      prisma.vehicle.findMany({
        where: {
          sonKonumLat: { not: null },
          sonKonumLng: { not: null },
          sonKonumZamani: { gte: new Date(Date.now() - KONUM_TAZELIK_MS) },
        },
        select: {
          id: true,
          plaka: true,
          sonKonumLat: true,
          sonKonumLng: true,
          sonKonumZamani: true,
          vehicleType: { select: { name: true } },
        },
      }),
      duzenleyebilir
        ? prisma.department.findMany({
            where: { aktif: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      personelAtayabilir
        ? prisma.personnel.findMany({
            where: {
              durum: "AKTIF",
              ...(rol === "DEPARTMENT_MANAGER"
                ? { departmentId: actor.user.departmentId }
                : {}),
            },
            orderBy: { adSoyad: "asc" },
            select: { id: true, adSoyad: true, unvan: true },
          })
        : Promise.resolve([]),
    ]);

  return {
    duzenleyebilir,
    personelAtayabilir,
    yollar: yollar.map((r) => ({
      id: r.id,
      ad: r.ad,
      koordinatlar: r.koordinatlar as [number, number][],
      durum: r.durum,
      dokumTarihi: iso(r.dokumTarihi),
      notlar: r.notlar,
      olusturan: r.createdBy.name,
      createdAt: iso(r.createdAt),
      departmentId: r.departmentId,
      mudurluk: r.department?.name ?? null,
      personel: r.personel.map((p) => ({
        id: p.personnel.id,
        adSoyad: p.personnel.adSoyad,
      })),
    })),
    engeller: engeller.map((h) => ({
      id: h.id,
      tip: h.tip,
      lat: h.lat,
      lng: h.lng,
      aciklama: h.aciklama,
      durum: h.durum,
      olusturan: h.createdBy.name,
      tarih: iso(h.createdAt),
      photoIds: h.photos.map((p) => p.id),
    })),
    sikayetler: sikayetler.map((c) => ({
      id: c.id,
      sikayetNo: c.sikayetNo,
      durum: SIKAYET_DURUM_LABELS[c.durum] ?? c.durum,
      durumKodu: c.durum,
      lat: c.lat as number,
      lng: c.lng as number,
      aciklama: c.aciklama,
    })),
    araclar: araclar.map((v) => ({
      id: v.id,
      plaka: v.plaka,
      tip: v.vehicleType?.name ?? null,
      lat: v.sonKonumLat as number,
      lng: v.sonKonumLng as number,
      zaman: iso(v.sonKonumZamani),
    })),
    mudurlukler,
    atanabilirPersonel: personeller,
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function serializeYol(yol: {
  id: string;
  ad: string;
  koordinatlar: unknown;
  durum: AsfaltDurum;
  dokumTarihi: Date | null;
  notlar: string | null;
  departmentId: string | null;
}) {
  return {
    id: yol.id,
    ad: yol.ad,
    koordinatlar: yol.koordinatlar as [number, number][],
    durum: yol.durum,
    dokumTarihi: iso(yol.dokumTarihi),
    notlar: yol.notlar,
    departmentId: yol.departmentId,
  };
}

/** Rota bir müdürlüğe atandığında o müdürlüğün yöneticileri bilgilendirilir. */
async function asfaltMudurlukBildir(
  actor: ServiceActor,
  roadAd: string,
  departmentId: string,
) {
  const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], departmentId);
  await bildirimGonder(
    yoneticiler.filter((uid) => uid !== actor.user.id),
    {
      tip: "ATAMA",
      baslik: "Asfalt rotası müdürlüğünüze atandı",
      mesaj: `${actor.user.name} "${roadAd}" rotasını müdürlüğünüze atadı.`,
      href: "/harita",
    },
  );
}
