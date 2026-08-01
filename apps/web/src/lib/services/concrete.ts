import { z } from "zod";
import { prisma } from "@kars/db";
import { betonUretimMalzeme } from "@kars/shared";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  bulunamadi,
  opsiyonelMetin,
  opsiyonelSayi,
  rolGerekli,
  sayiAlani,
  type ServiceActor,
  tarihAlani,
  zorunluMetin,
} from "@/lib/services/base";

export const betonUretimInputSchema = z.object({
  recipeId: zorunluMetin("Reçete zorunlu"),
  tarih: tarihAlani(),
  hedefM3: sayiAlani(z.number().positive("Hedef m³ 0'dan büyük olmalı")),
  notlar: opsiyonelMetin,
});

export type BetonUretimInput = z.input<typeof betonUretimInputSchema>;

export async function betonUretimOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.concrete);
  const data = betonUretimInputSchema.parse(input);

  const recipe = await prisma.concreteRecipe.findUnique({
    where: { id: data.recipeId },
  });
  if (!recipe) bulunamadi("Reçete");

  // Reçetedeki m³ başı değerler hedef m³ ile ölçeklenir (Excel formülü)
  const uretim = await prisma.concreteProduction.create({
    data: {
      tarih: data.tarih,
      recipeId: data.recipeId,
      hedefM3: data.hedefM3,
      cimentoKg: betonUretimMalzeme(data.hedefM3, recipe.cimentoKg),
      kumKg: betonUretimMalzeme(data.hedefM3, recipe.kumKg),
      micir05Kg: betonUretimMalzeme(data.hedefM3, recipe.micir05Kg),
      micir512Kg: betonUretimMalzeme(data.hedefM3, recipe.micir512Kg),
      micir1219Kg: betonUretimMalzeme(data.hedefM3, recipe.micir1219Kg),
      suLt: betonUretimMalzeme(data.hedefM3, recipe.suLt),
      katkiKg: betonUretimMalzeme(data.hedefM3, recipe.katkiKg),
      notlar: data.notlar,
    },
  });

  await auditKaydet(actor, "BETON_URETIM_OLUSTUR", {
    varlik: "ConcreteProduction",
    varlikId: uretim.id,
    detay: { recipeId: data.recipeId, hedefM3: data.hedefM3 },
  });
  return uretim;
}

export const betonStokGirisInputSchema = z.object({
  malzeme: zorunluMetin("Malzeme zorunlu"),
  miktar: sayiAlani(z.number().positive("Miktar 0'dan büyük olmalı")),
});

export type BetonStokGirisInput = z.input<typeof betonStokGirisInputSchema>;

export async function betonStokGiris(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.concrete);
  const data = betonStokGirisInputSchema.parse(input);

  const mevcut = await prisma.concreteStock.findUnique({
    where: { malzeme: data.malzeme },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Beton stok kalemi");

  const stok = await prisma.concreteStock.update({
    where: { malzeme: data.malzeme },
    data: { toplamGiris: { increment: data.miktar } },
  });

  await auditKaydet(actor, "BETON_STOK_GIRIS", {
    varlik: "ConcreteStock",
    varlikId: stok.id,
    detay: { malzeme: data.malzeme, miktar: data.miktar },
  });
  return stok;
}

/** Reçete kalemleri m³ başı; boş bırakılan kalem 0 sayılır (web formu böyle) */
const kalem = () => opsiyonelSayi(z.number().nonnegative());

export const betonReceteInputSchema = z.object({
  cimentoKg: kalem(),
  kumKg: kalem(),
  micir05Kg: kalem(),
  micir512Kg: kalem(),
  micir1219Kg: kalem(),
  suLt: kalem(),
  katkiKg: kalem(),
  aciklama: opsiyonelMetin,
});

export type BetonReceteInput = z.input<typeof betonReceteInputSchema>;

export async function betonReceteGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.concrete);
  const data = betonReceteInputSchema.parse(input);

  const mevcut = await prisma.concreteRecipe.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Reçete");

  const recete = await prisma.concreteRecipe.update({
    where: { id },
    data: {
      cimentoKg: data.cimentoKg ?? 0,
      kumKg: data.kumKg ?? 0,
      micir05Kg: data.micir05Kg ?? 0,
      micir512Kg: data.micir512Kg ?? 0,
      micir1219Kg: data.micir1219Kg ?? 0,
      suLt: data.suLt ?? 0,
      katkiKg: data.katkiKg ?? 0,
      aciklama: data.aciklama ?? null,
    },
  });

  await auditKaydet(actor, "BETON_RECETE_GUNCELLE", {
    varlik: "ConcreteRecipe",
    varlikId: id,
  });
  return recete;
}
