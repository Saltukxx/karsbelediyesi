import { z } from "zod";
import {
  BakimDurum,
  BakimTuru,
  EnvanterDurum,
  OperasyonDurum,
  prisma,
  YakitTipi,
  YakitTuru,
} from "@kars/db";
import { yakitTutari } from "@kars/shared";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  bosIse,
  bulunamadi,
  enumAlani,
  opsiyonelMetin as bosBoslukTemiz,
  opsiyonelSayi,
  opsiyonelTarih,
  rolGerekli,
  sayiAlani,
  ServiceError,
  type ServiceActor,
  zorunluMetin,
} from "@/lib/services/base";

export const aracInputSchema = z.object({
  plaka: zorunluMetin("Plaka zorunlu").transform((v) => v.toUpperCase()),
  ad: bosBoslukTemiz,
  vehicleTypeId: bosBoslukTemiz,
  marka: bosBoslukTemiz,
  model: bosBoslukTemiz,
  modelYili: opsiyonelSayi(z.number().int()),
  yakitTipi: bosIse(z.nativeEnum(YakitTipi).optional()),
  kapasite: bosBoslukTemiz,
  sayacDeger: opsiyonelSayi(),
  sayacBirim: bosIse(z.enum(["KM", "SAAT"]).default("KM")),
  normTuketim: opsiyonelSayi(),
  muayeneTarihi: opsiyonelTarih(),
  sigortaBitis: opsiyonelTarih(),
  sonBakimTarihi: opsiyonelTarih(),
  sonrakiBakimTarihi: opsiyonelTarih(),
  bakimKmSaati: bosBoslukTemiz,
  departmentId: bosBoslukTemiz,
  atananSoforId: bosBoslukTemiz,
  envanterDurumu: enumAlani(EnvanterDurum, EnvanterDurum.AKTIF),
  operasyonDurumu: enumAlani(OperasyonDurum, OperasyonDurum.MUSAIT),
  notlar: bosBoslukTemiz,
});

export type AracInput = z.input<typeof aracInputSchema>;

/** sayacTipi sayacBirim'den türetilir; iki alanın ayrışmasını engeller. */
function aracVerisi(input: unknown) {
  const { sayacBirim, ...parsed } = aracInputSchema.parse(input);
  return { ...parsed, sayacBirim, sayacTipi: sayacBirim };
}

/**
 * Müdür yalnızca kendi müdürlüğüne araç kaydedebilir; müdürlük alanını
 * kendi müdürlüğü dışına çeviremez.
 */
function mudurlukKapsamiDogrula(
  actor: ServiceActor,
  departmentId: string | undefined,
): string | undefined {
  if (actor.user.role !== "DEPARTMENT_MANAGER") return departmentId;
  if (!actor.user.departmentId) {
    throw new ServiceError("Hesabınıza bağlı müdürlük yok", 403);
  }
  if (departmentId && departmentId !== actor.user.departmentId) {
    throw new ServiceError("Araç yalnızca kendi müdürlüğünüze kaydedilebilir", 403);
  }
  return actor.user.departmentId;
}

export async function aracOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.vehicles);
  const data = aracVerisi(input);
  data.departmentId = mudurlukKapsamiDogrula(actor, data.departmentId);

  const mevcut = await prisma.vehicle.findUnique({
    where: { plaka: data.plaka },
    select: { id: true },
  });
  if (mevcut) {
    throw new ServiceError("Bu plaka ile kayıtlı araç var", 409);
  }

  const arac = await prisma.vehicle.create({ data });
  await auditKaydet(actor, "ARAC_OLUSTUR", {
    varlik: "Vehicle",
    varlikId: arac.id,
    detay: { plaka: data.plaka },
  });
  return arac;
}

export async function aracGuncelle(actor: ServiceActor, id: string, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.vehicles);

  const mevcut = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, departmentId: true },
  });
  if (!mevcut) bulunamadi("Araç");
  if (
    actor.user.role === "DEPARTMENT_MANAGER" &&
    mevcut.departmentId !== actor.user.departmentId
  ) {
    throw new ServiceError("Araç müdürlüğünüze bağlı değil", 403);
  }

  const data = aracVerisi(input);
  data.departmentId = mudurlukKapsamiDogrula(actor, data.departmentId);

  const cakisan = await prisma.vehicle.findFirst({
    where: { plaka: data.plaka, id: { not: id } },
    select: { id: true },
  });
  if (cakisan) {
    throw new ServiceError("Bu plaka ile kayıtlı başka bir araç var", 409);
  }

  const arac = await prisma.vehicle.update({ where: { id }, data });
  await auditKaydet(actor, "ARAC_GUNCELLE", {
    varlik: "Vehicle",
    varlikId: id,
    detay: { plaka: data.plaka },
  });
  return arac;
}

// ── BAKIM ────────────────────────────────────────────────────────────────────

export const bakimInputSchema = z.object({
  vehicleId: zorunluMetin("Araç zorunlu"),
  bakimTarihi: opsiyonelTarih(),
  bakimTuru: enumAlani(BakimTuru, BakimTuru.PERIYODIK),
  yapilanIslemler: bosBoslukTemiz,
  kullanilanMalzeme: bosBoslukTemiz,
  maliyet: opsiyonelSayi(z.number().nonnegative()),
  yapanFirmaPersonel: bosBoslukTemiz,
  sonrakiBakimTarihi: opsiyonelTarih(),
  durum: enumAlani(BakimDurum, BakimDurum.PLANLANDI),
});

export type BakimInput = z.input<typeof bakimInputSchema>;

export async function bakimOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.vehicles);
  const data = bakimInputSchema.parse(input);

  await aracErisimDogrula(actor, data.vehicleId);

  const kayit = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceRecord.create({
      data: {
        vehicleId: data.vehicleId,
        bakimTarihi: data.bakimTarihi ?? new Date(),
        bakimTuru: data.bakimTuru,
        yapilanIslemler: data.yapilanIslemler,
        kullanilanMalzeme: data.kullanilanMalzeme,
        maliyet: data.maliyet,
        yapanFirmaPersonel: data.yapanFirmaPersonel,
        sonrakiBakimTarihi: data.sonrakiBakimTarihi,
        durum: data.durum,
      },
    });
    // Araç kartındaki bakım tarihleri güncellenir (Excel'de manuel yapılıyordu)
    await tx.vehicle.update({
      where: { id: data.vehicleId },
      data: {
        ...(data.durum === "TAMAMLANDI" ? { sonBakimTarihi: new Date() } : {}),
        ...(data.sonrakiBakimTarihi
          ? { sonrakiBakimTarihi: data.sonrakiBakimTarihi }
          : {}),
        ...(data.durum === "DEVAM_EDIYOR"
          ? { envanterDurumu: "BAKIMDA" as const, operasyonDurumu: "BAKIMDA" as const }
          : {}),
      },
    });
    return created;
  });

  await auditKaydet(actor, "BAKIM_OLUSTUR", {
    varlik: "MaintenanceRecord",
    varlikId: kayit.id,
    detay: { vehicleId: data.vehicleId, durum: data.durum },
  });
  return kayit;
}

// ── YAKIT ────────────────────────────────────────────────────────────────────

export const yakitInputSchema = z.object({
  vehicleId: zorunluMetin("Araç zorunlu"),
  tarih: opsiyonelTarih(),
  yakitTuru: enumAlani(YakitTuru, YakitTuru.MOTORIN),
  litre: sayiAlani(z.number().positive("Litre pozitif olmalı")),
  birimFiyat: bosIse(sayiAlani(z.number().nonnegative()).default(0)),
  sayac: opsiyonelSayi(z.number().nonnegative()),
  sorumluPersonelId: bosBoslukTemiz,
  vehicleTaskId: bosBoslukTemiz,
});

export type YakitInput = z.input<typeof yakitInputSchema>;

export async function yakitOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.fuel);
  const data = yakitInputSchema.parse(input);

  await aracErisimDogrula(actor, data.vehicleId);

  const kayit = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelRecord.create({
      data: {
        vehicleId: data.vehicleId,
        tarih: data.tarih ?? new Date(),
        yakitTuru: data.yakitTuru,
        litre: data.litre,
        birimFiyat: data.birimFiyat,
        tutar: yakitTutari(data.litre, data.birimFiyat), // Excel H sütunu formülü
        sayac: data.sayac,
        sorumluPersonelId: data.sorumluPersonelId,
        vehicleTaskId: data.vehicleTaskId,
      },
    });
    if (data.sayac) {
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: { sayacDeger: data.sayac },
      });
    }
    return created;
  });

  await auditKaydet(actor, "YAKIT_OLUSTUR", {
    varlik: "FuelRecord",
    varlikId: kayit.id,
    detay: { vehicleId: data.vehicleId, litre: data.litre, birimFiyat: data.birimFiyat },
  });
  return kayit;
}

async function aracErisimDogrula(actor: ServiceActor, vehicleId: string) {
  const arac = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, departmentId: true },
  });
  if (!arac) bulunamadi("Araç");
  if (
    actor.user.role === "DEPARTMENT_MANAGER" &&
    arac.departmentId !== actor.user.departmentId
  ) {
    throw new ServiceError("Araç müdürlüğünüze bağlı değil", 403);
  }
  return arac;
}
