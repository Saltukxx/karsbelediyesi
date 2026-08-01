import { z } from "zod";
import { PersonelDurum, prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  bulunamadi,
  enumAlani,
  opsiyonelMetin,
  opsiyonelSayi,
  opsiyonelTarih,
  rolGerekli,
  type ServiceActor,
  zorunluMetin,
} from "@/lib/services/base";

export const personelInputSchema = z.object({
  adSoyad: zorunluMetin("Ad soyad zorunlu"),
  unvan: opsiyonelMetin,
  departmentId: opsiyonelMetin,
  telefon: opsiyonelMetin,
  iseGirisTarihi: opsiyonelTarih(),
  durum: enumAlani(PersonelDurum, PersonelDurum.AKTIF),
  not: opsiyonelMetin,
  saatUcret: opsiyonelSayi(z.number().nonnegative()),
});

export type PersonelInput = z.input<typeof personelInputSchema>;

export async function personelOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.personnel);
  const data = personelInputSchema.parse(input);

  const personel = await prisma.personnel.create({ data });

  await auditKaydet(actor, "PERSONEL_OLUSTUR", {
    varlik: "Personnel",
    varlikId: personel.id,
    detay: { adSoyad: personel.adSoyad },
  });
  return personel;
}

export async function personelGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.personnel);
  const data = personelInputSchema.parse(input);

  const mevcut = await prisma.personnel.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Personel");

  // Gönderilmeyen opsiyonel alanlar temizlenir; web formunun davranışı bu
  const personel = await prisma.personnel.update({
    where: { id },
    data: {
      adSoyad: data.adSoyad,
      unvan: data.unvan ?? null,
      departmentId: data.departmentId ?? null,
      telefon: data.telefon ?? null,
      iseGirisTarihi: data.iseGirisTarihi ?? null,
      durum: data.durum,
      not: data.not ?? null,
      saatUcret: data.saatUcret ?? null,
    },
  });

  await auditKaydet(actor, "PERSONEL_GUNCELLE", {
    varlik: "Personnel",
    varlikId: id,
  });
  return personel;
}
