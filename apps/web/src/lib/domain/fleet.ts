import { prisma } from "@kars/db";
import { yakitTutari } from "@kars/shared";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

export type VehicleWriteInput = {
  id?: string;
  plaka: string;
  ad?: string;
  vehicleTypeId?: string;
  marka?: string;
  model?: string;
  modelYili?: number;
  yakitTipi?: "DIZEL" | "BENZIN" | "LPG" | "ELEKTRIK" | "HIBRIT" | "DIGER";
  kapasite?: string;
  sayacDeger?: number;
  sayacBirim?: string;
  sayacTipi?: "KM" | "SAAT";
  normTuketim?: number;
  muayeneTarihi?: string;
  sigortaBitis?: string;
  sonBakimTarihi?: string;
  sonrakiBakimTarihi?: string;
  bakimKmSaati?: string;
  departmentId?: string;
  atananSoforId?: string;
  envanterDurumu?: "AKTIF" | "BAKIMDA" | "ARIZALI" | "HURDAYA_AYRILDI";
  operasyonDurumu?: "MUSAIT" | "GOREVDE" | "BAKIMDA" | "ARIZALI" | "PLANLI_BAKIM";
  notlar?: string;
};

function vehicleData(input: VehicleWriteInput) {
  return {
    plaka: input.plaka.trim().toUpperCase(),
    ad: input.ad,
    vehicleTypeId: input.vehicleTypeId,
    marka: input.marka,
    model: input.model,
    modelYili: input.modelYili,
    yakitTipi: input.yakitTipi,
    kapasite: input.kapasite,
    sayacDeger: input.sayacDeger,
    sayacBirim: input.sayacBirim ?? "KM",
    sayacTipi: input.sayacTipi ?? (input.sayacBirim === "SAAT" ? "SAAT" : "KM"),
    normTuketim: input.normTuketim,
    muayeneTarihi: input.muayeneTarihi ? new Date(input.muayeneTarihi) : undefined,
    sigortaBitis: input.sigortaBitis ? new Date(input.sigortaBitis) : undefined,
    sonBakimTarihi: input.sonBakimTarihi ? new Date(input.sonBakimTarihi) : undefined,
    sonrakiBakimTarihi: input.sonrakiBakimTarihi
      ? new Date(input.sonrakiBakimTarihi)
      : undefined,
    bakimKmSaati: input.bakimKmSaati,
    departmentId: input.departmentId,
    atananSoforId: input.atananSoforId,
    envanterDurumu: input.envanterDurumu ?? "AKTIF",
    operasyonDurumu: input.operasyonDurumu ?? "MUSAIT",
    notlar: input.notlar,
  };
}

export async function aracOlusturForUser(session: AppSession, input: VehicleWriteInput) {
  const data = vehicleData(input);
  const arac = await prisma.vehicle.create({ data });
  await auditKaydet(session, "ARAC_OLUSTUR", {
    varlik: "Vehicle",
    varlikId: arac.id,
    detay: { plaka: data.plaka },
  });
  return arac;
}

export async function aracGuncelleForUser(session: AppSession, input: VehicleWriteInput) {
  if (!input.id) throw new Error("Araç seçilmedi");
  const data = vehicleData(input);
  await prisma.vehicle.update({ where: { id: input.id }, data });
  await auditKaydet(session, "ARAC_GUNCELLE", {
    varlik: "Vehicle",
    varlikId: input.id,
    detay: { plaka: data.plaka },
  });
  return { ok: true };
}

export async function aracHurdayaAyirForUser(session: AppSession, id: string) {
  if (!id) throw new Error("Araç seçilmedi");
  const arac = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, plaka: true, envanterDurumu: true },
  });
  if (!arac) throw new Error("Araç bulunamadı");
  if (arac.envanterDurumu === "HURDAYA_AYRILDI") return { ok: true };
  const acikGorev = await prisma.vehicleTask.count({
    where: { vehicleId: id, durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] } },
  });
  if (acikGorev > 0) throw new Error("Açık görevi olan araç hurdaya ayrılamaz");
  await prisma.vehicle.update({
    where: { id },
    data: { envanterDurumu: "HURDAYA_AYRILDI", operasyonDurumu: "ARIZALI" },
  });
  await auditKaydet(session, "ARAC_HURDAYA", {
    varlik: "Vehicle",
    varlikId: id,
    detay: { plaka: arac.plaka },
  });
  return { ok: true };
}

export async function bakimOlusturForUser(
  session: AppSession,
  input: {
    vehicleId: string;
    bakimTarihi?: string;
    bakimTuru?: string;
    yapilanIslemler?: string;
    kullanilanMalzeme?: string;
    maliyet?: number;
    yapanFirmaPersonel?: string;
    sonrakiBakimTarihi?: string;
    durum?: string;
  },
) {
  if (!input.vehicleId) throw new Error("Araç seçilmedi");
  const durum = (input.durum ?? "PLANLANDI") as "TAMAMLANDI" | "DEVAM_EDIYOR" | "PLANLANDI";
  const sonrakiBakim = input.sonrakiBakimTarihi ? new Date(input.sonrakiBakimTarihi) : undefined;
  const kayit = await prisma.$transaction(async (tx) => {
    const rec = await tx.maintenanceRecord.create({
      data: {
        vehicleId: input.vehicleId,
        bakimTarihi: input.bakimTarihi ? new Date(input.bakimTarihi) : new Date(),
        bakimTuru: (input.bakimTuru ?? "PERIYODIK") as never,
        yapilanIslemler: input.yapilanIslemler,
        kullanilanMalzeme: input.kullanilanMalzeme,
        maliyet: input.maliyet,
        yapanFirmaPersonel: input.yapanFirmaPersonel,
        sonrakiBakimTarihi: sonrakiBakim,
        durum,
      },
    });
    await tx.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        ...(durum === "TAMAMLANDI" ? { sonBakimTarihi: new Date() } : {}),
        ...(sonrakiBakim ? { sonrakiBakimTarihi: sonrakiBakim } : {}),
        ...(durum === "DEVAM_EDIYOR"
          ? { envanterDurumu: "BAKIMDA" as const, operasyonDurumu: "BAKIMDA" as const }
          : {}),
      },
    });
    return rec;
  });
  await auditKaydet(session, "BAKIM_OLUSTUR", {
    varlik: "MaintenanceRecord",
    varlikId: kayit.id,
    detay: { vehicleId: input.vehicleId, durum },
  });
  return kayit;
}

export async function bakimGuncelleForUser(
  session: AppSession,
  input: {
    id: string;
    vehicleId: string;
    bakimTarihi?: string;
    bakimTuru?: string;
    yapilanIslemler?: string;
    kullanilanMalzeme?: string;
    maliyet?: number;
    yapanFirmaPersonel?: string;
    sonrakiBakimTarihi?: string;
    durum?: string;
  },
) {
  if (!input.id) throw new Error("Kayıt bulunamadı");
  const durum = (input.durum ?? "PLANLANDI") as "TAMAMLANDI" | "DEVAM_EDIYOR" | "PLANLANDI";
  const sonrakiBakim = input.sonrakiBakimTarihi ? new Date(input.sonrakiBakimTarihi) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRecord.update({
      where: { id: input.id },
      data: {
        vehicleId: input.vehicleId,
        bakimTarihi: input.bakimTarihi ? new Date(input.bakimTarihi) : new Date(),
        bakimTuru: (input.bakimTuru ?? "PERIYODIK") as never,
        yapilanIslemler: input.yapilanIslemler,
        kullanilanMalzeme: input.kullanilanMalzeme,
        maliyet: input.maliyet,
        yapanFirmaPersonel: input.yapanFirmaPersonel,
        sonrakiBakimTarihi: sonrakiBakim ?? null,
        durum,
      },
    });
    await tx.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        ...(durum === "TAMAMLANDI" ? { sonBakimTarihi: new Date() } : {}),
        ...(sonrakiBakim ? { sonrakiBakimTarihi: sonrakiBakim } : {}),
        ...(durum === "DEVAM_EDIYOR"
          ? { envanterDurumu: "BAKIMDA" as const, operasyonDurumu: "BAKIMDA" as const }
          : {}),
      },
    });
  });
  await auditKaydet(session, "BAKIM_GUNCELLE", {
    varlik: "MaintenanceRecord",
    varlikId: input.id,
    detay: { vehicleId: input.vehicleId, durum },
  });
  return { ok: true };
}

export async function bakimSilForUser(session: AppSession, id: string) {
  await prisma.maintenanceRecord.delete({ where: { id } });
  await auditKaydet(session, "BAKIM_SIL", { varlik: "MaintenanceRecord", varlikId: id });
  return { ok: true };
}

export async function yakitOlusturForUser(
  session: AppSession,
  input: {
    vehicleId: string;
    tarih: string;
    litre: number;
    birimFiyat: number;
    yakitTuru?: string;
    sayac?: number;
    istasyon?: string;
    sorumluPersonelId?: string;
    vehicleTaskId?: string;
  },
) {
  const kayit = await prisma.$transaction(async (tx) => {
    const rec = await tx.fuelRecord.create({
      data: {
        vehicleId: input.vehicleId,
        tarih: new Date(input.tarih),
        yakitTuru: (input.yakitTuru ?? "MOTORIN") as never,
        litre: input.litre,
        birimFiyat: input.birimFiyat,
        tutar: yakitTutari(input.litre, input.birimFiyat),
        sayac: input.sayac,
        sorumluPersonelId: input.sorumluPersonelId,
        vehicleTaskId: input.vehicleTaskId,
      },
    });
    if (input.sayac) {
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { sayacDeger: input.sayac },
      });
    }
    return rec;
  });
  await auditKaydet(session, "YAKIT_OLUSTUR", {
    varlik: "FuelRecord",
    varlikId: kayit.id,
    detay: { vehicleId: input.vehicleId, litre: input.litre, birimFiyat: input.birimFiyat },
  });
  return kayit;
}

export async function yakitGuncelleForUser(
  session: AppSession,
  input: {
    id: string;
    vehicleId: string;
    tarih: string;
    litre: number;
    birimFiyat: number;
    yakitTuru?: string;
    sayac?: number;
    istasyon?: string;
    sorumluPersonelId?: string;
    vehicleTaskId?: string;
  },
) {
  if (!input.id) throw new Error("Kayıt bulunamadı");
  const mevcut = await prisma.fuelRecord.findUnique({
    where: { id: input.id },
    select: { vehicleWorkLogId: true },
  });
  if (!mevcut) throw new Error("Kayıt bulunamadı");
  await prisma.$transaction(async (tx) => {
    await tx.fuelRecord.update({
      where: { id: input.id },
      data: {
        vehicleId: input.vehicleId,
        tarih: new Date(input.tarih),
        yakitTuru: (input.yakitTuru ?? "MOTORIN") as never,
        litre: input.litre,
        birimFiyat: input.birimFiyat,
        tutar: yakitTutari(input.litre, input.birimFiyat),
        sayac: input.sayac ?? null,
        sorumluPersonelId: input.sorumluPersonelId ?? null,
        vehicleTaskId: input.vehicleTaskId ?? null,
      },
    });
    if (input.sayac) {
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { sayacDeger: input.sayac },
      });
    }
    if (mevcut.vehicleWorkLogId) {
      await tx.vehicleWorkLog.update({
        where: { id: mevcut.vehicleWorkLogId },
        data: { yakitLitre: input.litre },
      });
    }
  });
  await auditKaydet(session, "YAKIT_GUNCELLE", {
    varlik: "FuelRecord",
    varlikId: input.id,
    detay: { vehicleId: input.vehicleId, litre: input.litre, birimFiyat: input.birimFiyat },
  });
  return { ok: true };
}

export async function yakitSilForUser(session: AppSession, id: string) {
  if (!id) throw new Error("Kayıt bulunamadı");
  const kayit = await prisma.fuelRecord.findUnique({
    where: { id },
    select: { vehicleId: true, vehicleWorkLogId: true },
  });
  if (!kayit) throw new Error("Kayıt bulunamadı");
  await prisma.$transaction(async (tx) => {
    await tx.fuelRecord.delete({ where: { id } });
    if (kayit.vehicleWorkLogId) {
      await tx.vehicleWorkLog.update({
        where: { id: kayit.vehicleWorkLogId },
        data: { yakitLitre: null },
      });
    }
  });
  await auditKaydet(session, "YAKIT_SIL", {
    varlik: "FuelRecord",
    varlikId: id,
    detay: { vehicleId: kayit.vehicleId },
  });
  return { ok: true };
}
