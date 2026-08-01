import { z } from "zod";
import { CalismaTipi, prisma, YakitTuru } from "@kars/db";
import {
  aracCalismaSaatiHesapla,
  mesaiSaatHesapla,
  normalSaatHesapla,
  toplamSaatHesapla,
  yakitTutari,
} from "@kars/shared";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  enumAlani,
  opsiyonelMetin,
  opsiyonelSayi,
  rolGerekli,
  saatAlani,
  ServiceError,
  type ServiceActor,
  tarihAlani,
  zorunluMetin,
} from "@/lib/services/base";

export const personelGunlukInputSchema = z.object({
  personnelId: zorunluMetin("Personel zorunlu"),
  tarih: tarihAlani(),
  girisSaati: saatAlani(),
  cikisSaati: saatAlani(),
  calismaTipi: enumAlani(CalismaTipi, CalismaTipi.NORMAL_MESAI),
  yapilanIs: opsiyonelMetin,
  gorevlendirilenBirimId: opsiyonelMetin,
  notlar: opsiyonelMetin,
  onaylayanId: opsiyonelMetin,
});

export type PersonelGunlukInput = z.input<typeof personelGunlukInputSchema>;

export async function personelGunlukOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.worklogs);
  const data = personelGunlukInputSchema.parse(input);

  const personel = await prisma.personnel.findUnique({
    where: { id: data.personnelId },
    select: { id: true },
  });
  if (!personel) throw new ServiceError("Personel bulunamadı", 404);

  // (personnelId, tarih) tekil; aynı güne ikinci kayıt P2002 → 409 olur
  const log = await prisma.personnelWorkLog.create({
    data: {
      personnelId: data.personnelId,
      tarih: data.tarih,
      girisSaati: data.girisSaati,
      cikisSaati: data.cikisSaati,
      normalSaat: normalSaatHesapla(data.girisSaati, data.cikisSaati),
      mesaiSaat: mesaiSaatHesapla(data.girisSaati, data.cikisSaati),
      toplamSaat: toplamSaatHesapla(data.girisSaati, data.cikisSaati),
      calismaTipi: data.calismaTipi,
      yapilanIs: data.yapilanIs,
      gorevlendirilenBirimId: data.gorevlendirilenBirimId,
      notlar: data.notlar,
      onaylayanId: data.onaylayanId,
    },
  });

  await auditKaydet(actor, "PERSONEL_GUNLUK_OLUSTUR", {
    varlik: "PersonnelWorkLog",
    varlikId: log.id,
    detay: { tarih: data.tarih.toISOString().slice(0, 10) },
  });
  return log;
}

export const aracGunlukInputSchema = z.object({
  vehicleId: zorunluMetin("Araç zorunlu"),
  tarih: tarihAlani(),
  girisSaati: saatAlani(),
  cikisSaati: saatAlani(),
  driverId: opsiyonelMetin,
  soforAdi: opsiyonelMetin,
  gorevTanimi: opsiyonelMetin,
  yerBolge: opsiyonelMetin,
  yakitLitre: opsiyonelSayi(z.number().nonnegative()),
  yakitTuru: enumAlani(YakitTuru, YakitTuru.MOTORIN),
  birimFiyat: opsiyonelSayi(z.number().nonnegative()),
  notlar: opsiyonelMetin,
  onaylayanId: opsiyonelMetin,
});

export type AracGunlukInput = z.input<typeof aracGunlukInputSchema>;

export async function aracGunlukOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.worklogs);
  const data = aracGunlukInputSchema.parse(input);

  const arac = await prisma.vehicle.findUnique({
    where: { id: data.vehicleId },
    select: { id: true },
  });
  if (!arac) throw new ServiceError("Araç bulunamadı", 404);

  let soforAdi = data.soforAdi;
  if (data.driverId && !soforAdi) {
    const u = await prisma.user.findUnique({
      where: { id: data.driverId },
      select: { name: true },
    });
    soforAdi = u?.name ?? undefined;
  }

  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicleWorkLog.create({
      data: {
        vehicleId: data.vehicleId,
        tarih: data.tarih,
        driverId: data.driverId,
        soforAdi,
        gorevTanimi: data.gorevTanimi,
        yerBolge: data.yerBolge,
        girisSaati: data.girisSaati,
        cikisSaati: data.cikisSaati,
        calismaSaati: aracCalismaSaatiHesapla(data.girisSaati, data.cikisSaati),
        yakitLitre: data.yakitLitre,
        notlar: data.notlar,
        onaylayanId: data.onaylayanId,
      },
    });

    // Yakıt litresi varsa FuelRecord tek kaynak olarak yazılır
    if (data.yakitLitre != null && data.yakitLitre > 0) {
      const birimFiyat = data.birimFiyat ?? 0;
      await tx.fuelRecord.create({
        data: {
          vehicleId: data.vehicleId,
          tarih: data.tarih,
          yakitTuru: data.yakitTuru,
          litre: data.yakitLitre,
          birimFiyat,
          tutar: yakitTutari(data.yakitLitre, birimFiyat),
          vehicleWorkLogId: created.id,
        },
      });
    }
    return created;
  });

  await auditKaydet(actor, "ARAC_GUNLUK_OLUSTUR", {
    varlik: "VehicleWorkLog",
    varlikId: log.id,
    detay: { vehicleId: data.vehicleId, tarih: data.tarih.toISOString().slice(0, 10) },
  });
  return log;
}
