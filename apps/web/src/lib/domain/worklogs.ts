import { prisma, isUniqueViolation } from "@kars/db";
import {
  normalSaatHesapla,
  mesaiSaatHesapla,
  toplamSaatHesapla,
  aracCalismaSaatiHesapla,
  yakitTutari,
} from "@kars/shared";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

export type PersonelGunlukInput = {
  id?: string;
  personnelId: string;
  tarih: string;
  girisSaati: string;
  cikisSaati: string;
  calismaTipi?: string;
  yapilanIs?: string;
  gorevlendirilenBirimId?: string;
  notlar?: string;
  onaylayanId?: string;
};

export type AracGunlukInput = {
  id?: string;
  vehicleId: string;
  tarih: string;
  girisSaati: string;
  cikisSaati: string;
  driverId?: string;
  soforAdi?: string;
  gorevTanimi?: string;
  yerBolge?: string;
  yakitLitre?: number;
  birimFiyat?: number;
  yakitTuru?: string;
  notlar?: string;
  onaylayanId?: string;
};

export async function personelGunlukOlusturForUser(
  session: AppSession,
  input: PersonelGunlukInput,
) {
  const tarih = new Date(input.tarih);
  await prisma.personnelWorkLog.create({
    data: {
      personnelId: input.personnelId,
      tarih,
      girisSaati: input.girisSaati,
      cikisSaati: input.cikisSaati,
      normalSaat: normalSaatHesapla(input.girisSaati, input.cikisSaati),
      mesaiSaat: mesaiSaatHesapla(input.girisSaati, input.cikisSaati),
      toplamSaat: toplamSaatHesapla(input.girisSaati, input.cikisSaati),
      calismaTipi: (input.calismaTipi ?? "NORMAL_MESAI") as never,
      yapilanIs: input.yapilanIs,
      gorevlendirilenBirimId: input.gorevlendirilenBirimId,
      notlar: input.notlar,
      onaylayanId: input.onaylayanId,
    },
  });
  await auditKaydet(session, "PERSONEL_GUNLUK_OLUSTUR", {
    varlik: "PersonnelWorkLog",
    detay: { tarih: tarih.toISOString().slice(0, 10) },
  });
  return { ok: true };
}

export async function personelGunlukGuncelleForUser(
  session: AppSession,
  input: PersonelGunlukInput,
) {
  if (!input.id) throw new Error("Kayıt bulunamadı");
  const tarih = new Date(input.tarih);
  try {
    await prisma.personnelWorkLog.update({
      where: { id: input.id },
      data: {
        personnelId: input.personnelId,
        tarih,
        girisSaati: input.girisSaati,
        cikisSaati: input.cikisSaati,
        normalSaat: normalSaatHesapla(input.girisSaati, input.cikisSaati),
        mesaiSaat: mesaiSaatHesapla(input.girisSaati, input.cikisSaati),
        toplamSaat: toplamSaatHesapla(input.girisSaati, input.cikisSaati),
        calismaTipi: (input.calismaTipi ?? "NORMAL_MESAI") as never,
        yapilanIs: input.yapilanIs ?? null,
        gorevlendirilenBirimId: input.gorevlendirilenBirimId ?? null,
        notlar: input.notlar ?? null,
        onaylayanId: input.onaylayanId ?? null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("Bu personel için aynı tarihte kayıt zaten var");
    }
    throw err;
  }
  await auditKaydet(session, "PERSONEL_GUNLUK_GUNCELLE", {
    varlik: "PersonnelWorkLog",
    varlikId: input.id,
    detay: { tarih: tarih.toISOString().slice(0, 10) },
  });
  return { ok: true };
}

export async function personelGunlukSilForUser(session: AppSession, id: string) {
  if (!id) throw new Error("Kayıt bulunamadı");
  await prisma.personnelWorkLog.delete({ where: { id } });
  await auditKaydet(session, "PERSONEL_GUNLUK_SIL", {
    varlik: "PersonnelWorkLog",
    varlikId: id,
  });
  return { ok: true };
}

export async function aracGunlukOlusturForUser(
  session: AppSession,
  input: AracGunlukInput,
) {
  const tarih = new Date(input.tarih);
  let soforAdi = input.soforAdi;
  if (input.driverId && !soforAdi) {
    const u = await prisma.user.findUnique({ where: { id: input.driverId } });
    soforAdi = u?.name;
  }
  await prisma.$transaction(async (tx) => {
    const log = await tx.vehicleWorkLog.create({
      data: {
        vehicleId: input.vehicleId,
        tarih,
        driverId: input.driverId,
        soforAdi,
        gorevTanimi: input.gorevTanimi,
        yerBolge: input.yerBolge,
        girisSaati: input.girisSaati,
        cikisSaati: input.cikisSaati,
        calismaSaati: aracCalismaSaatiHesapla(input.girisSaati, input.cikisSaati),
        yakitLitre: input.yakitLitre,
        notlar: input.notlar,
        onaylayanId: input.onaylayanId,
      },
    });
    if (input.yakitLitre != null && input.yakitLitre > 0) {
      const birimFiyat = input.birimFiyat ?? 0;
      await tx.fuelRecord.create({
        data: {
          vehicleId: input.vehicleId,
          tarih,
          yakitTuru: (input.yakitTuru ?? "MOTORIN") as never,
          litre: input.yakitLitre,
          birimFiyat,
          tutar: yakitTutari(input.yakitLitre, birimFiyat),
          vehicleWorkLogId: log.id,
        },
      });
    }
  });
  await auditKaydet(session, "ARAC_GUNLUK_OLUSTUR", {
    varlik: "VehicleWorkLog",
    detay: { vehicleId: input.vehicleId, tarih: tarih.toISOString().slice(0, 10) },
  });
  return { ok: true };
}

export async function aracGunlukGuncelleForUser(
  session: AppSession,
  input: AracGunlukInput,
) {
  if (!input.id) throw new Error("Kayıt bulunamadı");
  const tarih = new Date(input.tarih);
  let soforAdi = input.soforAdi ?? null;
  if (input.driverId && !soforAdi) {
    const u = await prisma.user.findUnique({ where: { id: input.driverId } });
    soforAdi = u?.name ?? null;
  }
  await prisma.$transaction(async (tx) => {
    await tx.vehicleWorkLog.update({
      where: { id: input.id },
      data: {
        vehicleId: input.vehicleId,
        tarih,
        driverId: input.driverId ?? null,
        soforAdi,
        gorevTanimi: input.gorevTanimi ?? null,
        yerBolge: input.yerBolge ?? null,
        girisSaati: input.girisSaati,
        cikisSaati: input.cikisSaati,
        calismaSaati: aracCalismaSaatiHesapla(input.girisSaati, input.cikisSaati),
        yakitLitre: input.yakitLitre ?? null,
        notlar: input.notlar ?? null,
        onaylayanId: input.onaylayanId ?? null,
      },
    });
    const fuel = await tx.fuelRecord.findUnique({
      where: { vehicleWorkLogId: input.id },
    });
    if (input.yakitLitre != null && input.yakitLitre > 0) {
      const birimFiyat = input.birimFiyat ?? 0;
      const data = {
        vehicleId: input.vehicleId,
        tarih,
        yakitTuru: (input.yakitTuru ?? "MOTORIN") as never,
        litre: input.yakitLitre,
        birimFiyat,
        tutar: yakitTutari(input.yakitLitre, birimFiyat),
        vehicleWorkLogId: input.id,
      };
      if (fuel) {
        await tx.fuelRecord.update({ where: { id: fuel.id }, data });
      } else {
        await tx.fuelRecord.create({ data });
      }
    } else if (fuel) {
      await tx.fuelRecord.delete({ where: { id: fuel.id } });
    }
  });
  await auditKaydet(session, "ARAC_GUNLUK_GUNCELLE", {
    varlik: "VehicleWorkLog",
    varlikId: input.id,
    detay: { vehicleId: input.vehicleId, tarih: tarih.toISOString().slice(0, 10) },
  });
  return { ok: true };
}

export async function aracGunlukSilForUser(session: AppSession, id: string) {
  if (!id) throw new Error("Kayıt bulunamadı");
  await prisma.$transaction(async (tx) => {
    await tx.fuelRecord.deleteMany({ where: { vehicleWorkLogId: id } });
    await tx.vehicleWorkLog.delete({ where: { id } });
  });
  await auditKaydet(session, "ARAC_GUNLUK_SIL", {
    varlik: "VehicleWorkLog",
    varlikId: id,
  });
  return { ok: true };
}
