"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import {
  normalSaatHesapla,
  mesaiSaatHesapla,
  toplamSaatHesapla,
  aracCalismaSaatiHesapla,
  yakitTutari,
} from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

export async function personelGunlukOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);

  const girisSaati = String(formData.get("girisSaati"));
  const cikisSaati = String(formData.get("cikisSaati"));
  const tarih = new Date(String(formData.get("tarih")));

  await prisma.personnelWorkLog.create({
    data: {
      personnelId: String(formData.get("personnelId")),
      tarih,
      girisSaati,
      cikisSaati,
      normalSaat: normalSaatHesapla(girisSaati, cikisSaati),
      mesaiSaat: mesaiSaatHesapla(girisSaati, cikisSaati),
      toplamSaat: toplamSaatHesapla(girisSaati, cikisSaati),
      calismaTipi: (bos(formData.get("calismaTipi")) ?? "NORMAL_MESAI") as never,
      yapilanIs: bos(formData.get("yapilanIs")),
      gorevlendirilenBirimId: bos(formData.get("gorevlendirilenBirimId")),
      notlar: bos(formData.get("notlar")),
      onaylayanId: bos(formData.get("onaylayanId")),
    },
  });

  revalidatePath("/gunluk-calisma");
}

export async function aracGunlukOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);

  const vehicleId = String(formData.get("vehicleId"));
  const girisSaati = String(formData.get("girisSaati"));
  const cikisSaati = String(formData.get("cikisSaati"));
  const tarih = new Date(String(formData.get("tarih")));
  const yakitLitre = sayi(formData.get("yakitLitre"));
  const driverId = bos(formData.get("driverId"));

  let soforAdi = bos(formData.get("soforAdi"));
  if (driverId && !soforAdi) {
    const u = await prisma.user.findUnique({ where: { id: driverId } });
    soforAdi = u?.name;
  }

  await prisma.$transaction(async (tx) => {
    const log = await tx.vehicleWorkLog.create({
      data: {
        vehicleId,
        tarih,
        driverId,
        soforAdi,
        gorevTanimi: bos(formData.get("gorevTanimi")),
        yerBolge: bos(formData.get("yerBolge")),
        girisSaati,
        cikisSaati,
        calismaSaati: aracCalismaSaatiHesapla(girisSaati, cikisSaati),
        yakitLitre,
        notlar: bos(formData.get("notlar")),
        onaylayanId: bos(formData.get("onaylayanId")),
      },
    });

    // Yakıt litresi varsa FuelRecord tek kaynak olarak yazılır
    if (yakitLitre != null && yakitLitre > 0) {
      const birimFiyat = sayi(formData.get("birimFiyat")) ?? 0;
      await tx.fuelRecord.create({
        data: {
          vehicleId,
          tarih,
          yakitTuru: (bos(formData.get("yakitTuru")) ?? "MOTORIN") as never,
          litre: yakitLitre,
          birimFiyat,
          tutar: yakitTutari(yakitLitre, birimFiyat),
          vehicleWorkLogId: log.id,
        },
      });
    }
  });

  revalidatePath("/gunluk-calisma");
  revalidatePath("/yakit");
}
