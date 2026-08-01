import { z } from "zod";
import { prisma, StokHareketTipi } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  opsiyonelMetin,
  opsiyonelSayi,
  opsiyonelTarih,
  rolGerekli,
  sayiAlani,
  ServiceError,
  type ServiceActor,
  zorunluMetin,
} from "@/lib/services/base";

export const malzemeInputSchema = z.object({
  kod: zorunluMetin("Kod zorunlu"),
  ad: zorunluMetin("Ad zorunlu"),
  kategori: zorunluMetin("Kategori zorunlu"),
  birim: zorunluMetin("Birim zorunlu"),
  depoLokasyon: opsiyonelMetin,
  kritikStok: opsiyonelSayi(z.number().nonnegative()),
  birimFiyat: opsiyonelSayi(z.number().nonnegative()),
  aciklama: opsiyonelMetin,
});

export type MalzemeInput = z.input<typeof malzemeInputSchema>;

export async function malzemeOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.materials);
  const data = malzemeInputSchema.parse(input);

  const malzeme = await prisma.material.create({
    data: { ...data, kritikStok: data.kritikStok ?? 0 },
  });

  await auditKaydet(actor, "MALZEME_OLUSTUR", {
    varlik: "Material",
    varlikId: malzeme.id,
    detay: { kod: malzeme.kod, ad: malzeme.ad },
  });
  return malzeme;
}

export const stokHareketInputSchema = z.object({
  materialId: zorunluMetin("Malzeme zorunlu"),
  tarih: opsiyonelTarih(),
  tip: z.nativeEnum(StokHareketTipi),
  miktar: sayiAlani(z.number().positive("Miktar 0'dan büyük olmalı")),
  departmentId: opsiyonelMetin,
  belgeNo: opsiyonelMetin,
  aciklama: opsiyonelMetin,
  vehicleTaskId: opsiyonelMetin,
});

export type StokHareketInput = z.input<typeof stokHareketInputSchema>;

export async function stokHareketOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.materials);
  const data = stokHareketInputSchema.parse(input);

  const malzeme = await prisma.material.findUnique({
    where: { id: data.materialId },
    select: { id: true },
  });
  if (!malzeme) throw new ServiceError("Malzeme bulunamadı", 404);

  if (data.tip === StokHareketTipi.CIKIS) {
    await yeterliStokDogrula(data.materialId, data.miktar);
  }

  const hareket = await prisma.materialMovement.create({
    data: {
      materialId: data.materialId,
      tarih: data.tarih ?? new Date(),
      tip: data.tip,
      miktar: data.miktar,
      departmentId: data.departmentId,
      belgeNo: data.belgeNo,
      aciklama: data.aciklama,
      // Yalnızca ÇIKIŞ hareketi bir göreve bağlanır (iş başına maliyet)
      vehicleTaskId:
        data.tip === StokHareketTipi.CIKIS ? (data.vehicleTaskId ?? null) : null,
    },
  });

  await auditKaydet(actor, "STOK_HAREKET_OLUSTUR", {
    varlik: "MaterialMovement",
    varlikId: hareket.id,
    detay: { materialId: data.materialId, tip: data.tip, miktar: data.miktar },
  });
  return hareket;
}

async function yeterliStokDogrula(materialId: string, miktar: number): Promise<void> {
  const movements = await prisma.materialMovement.findMany({
    where: { materialId },
    select: { tip: true, miktar: true },
  });
  const giris = movements
    .filter((m) => m.tip === StokHareketTipi.GIRIS)
    .reduce((s, m) => s + Number(m.miktar), 0);
  const cikis = movements
    .filter((m) => m.tip === StokHareketTipi.CIKIS)
    .reduce((s, m) => s + Number(m.miktar), 0);
  const stok = mevcutStok(giris, cikis);
  if (miktar > stok) {
    throw new ServiceError(`Yetersiz stok (mevcut: ${stok})`, 409);
  }
}
