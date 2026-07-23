"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@kars/db";
import { yakitTutari } from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

function bosIseUndefined(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function tarih(v: FormDataEntryValue | null): Date | undefined {
  const s = bosIseUndefined(v);
  return s ? new Date(s) : undefined;
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bosIseUndefined(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

// ── ARAÇ (Excel: Araç Envanteri + Araç Havuzu birleşik) ──────────────────────

const aracSchema = z.object({
  plaka: z.string().min(1, "Plaka zorunlu"),
  ad: z.string().optional(),
  vehicleTypeId: z.string().optional(),
  marka: z.string().optional(),
  model: z.string().optional(),
  modelYili: z.number().int().optional(),
  yakitTipi: z.enum(["DIZEL", "BENZIN", "LPG", "ELEKTRIK", "HIBRIT", "DIGER"]).optional(),
  kapasite: z.string().optional(),
  sayacDeger: z.number().optional(),
  sayacBirim: z.string().optional(),
  sayacTipi: z.enum(["KM", "SAAT"]).optional(),
  normTuketim: z.number().optional(),
  muayeneTarihi: z.date().optional(),
  sigortaBitis: z.date().optional(),
  sonBakimTarihi: z.date().optional(),
  sonrakiBakimTarihi: z.date().optional(),
  bakimKmSaati: z.string().optional(),
  departmentId: z.string().optional(),
  atananSoforId: z.string().optional(),
  envanterDurumu: z.enum(["AKTIF", "BAKIMDA", "ARIZALI", "HURDAYA_AYRILDI"]),
  operasyonDurumu: z.enum(["MUSAIT", "GOREVDE", "BAKIMDA", "ARIZALI", "PLANLI_BAKIM"]),
  notlar: z.string().optional(),
});

function aracVerisi(formData: FormData) {
  return aracSchema.parse({
    plaka: String(formData.get("plaka") ?? "").trim().toUpperCase(),
    ad: bosIseUndefined(formData.get("ad")),
    vehicleTypeId: bosIseUndefined(formData.get("vehicleTypeId")),
    marka: bosIseUndefined(formData.get("marka")),
    model: bosIseUndefined(formData.get("model")),
    modelYili: sayi(formData.get("modelYili")),
    yakitTipi: bosIseUndefined(formData.get("yakitTipi")) as never,
    kapasite: bosIseUndefined(formData.get("kapasite")),
    sayacDeger: sayi(formData.get("sayacDeger")),
    sayacBirim: bosIseUndefined(formData.get("sayacBirim")) ?? "KM",
    sayacTipi: (bosIseUndefined(formData.get("sayacBirim")) === "SAAT" ? "SAAT" : "KM") as "KM" | "SAAT",
    normTuketim: sayi(formData.get("normTuketim")),
    muayeneTarihi: tarih(formData.get("muayeneTarihi")),
    sigortaBitis: tarih(formData.get("sigortaBitis")),
    sonBakimTarihi: tarih(formData.get("sonBakimTarihi")),
    sonrakiBakimTarihi: tarih(formData.get("sonrakiBakimTarihi")),
    bakimKmSaati: bosIseUndefined(formData.get("bakimKmSaati")),
    departmentId: bosIseUndefined(formData.get("departmentId")),
    atananSoforId: bosIseUndefined(formData.get("atananSoforId")),
    envanterDurumu: (bosIseUndefined(formData.get("envanterDurumu")) ?? "AKTIF") as never,
    operasyonDurumu: (bosIseUndefined(formData.get("operasyonDurumu")) ?? "MUSAIT") as never,
    notlar: bosIseUndefined(formData.get("notlar")),
  });
}

export async function aracOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  const data = aracVerisi(formData);
  const arac = await prisma.vehicle.create({ data });
  await auditKaydet(session, "ARAC_OLUSTUR", {
    varlik: "Vehicle",
    varlikId: arac.id,
    detay: { plaka: data.plaka },
  });
  revalidatePath("/araclar");
  redirect(`/araclar/${arac.id}`);
}

export async function aracGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  const id = String(formData.get("id"));
  const data = aracVerisi(formData);
  await prisma.vehicle.update({ where: { id }, data });
  await auditKaydet(session, "ARAC_GUNCELLE", {
    varlik: "Vehicle",
    varlikId: id,
    detay: { plaka: data.plaka },
  });
  revalidatePath("/araclar");
  revalidatePath(`/araclar/${id}`);
  redirect(`/araclar/${id}`);
}

// ── BAKIM (Excel: Bakım Takip — 11 sütun) ────────────────────────────────────

export async function bakimOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);

  const vehicleId = String(formData.get("vehicleId"));
  const durum = (bosIseUndefined(formData.get("durum")) ?? "PLANLANDI") as
    | "TAMAMLANDI"
    | "DEVAM_EDIYOR"
    | "PLANLANDI";
  const sonrakiBakim = tarih(formData.get("sonrakiBakimTarihi"));

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRecord.create({
      data: {
        vehicleId,
        bakimTarihi: tarih(formData.get("bakimTarihi")) ?? new Date(),
        bakimTuru: (bosIseUndefined(formData.get("bakimTuru")) ?? "PERIYODIK") as never,
        yapilanIslemler: bosIseUndefined(formData.get("yapilanIslemler")),
        kullanilanMalzeme: bosIseUndefined(formData.get("kullanilanMalzeme")),
        maliyet: sayi(formData.get("maliyet")),
        yapanFirmaPersonel: bosIseUndefined(formData.get("yapanFirmaPersonel")),
        sonrakiBakimTarihi: sonrakiBakim,
        durum,
      },
    });
    // Araç kartındaki bakım tarihleri güncellenir (Excel'de manuel yapılıyordu)
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(durum === "TAMAMLANDI" ? { sonBakimTarihi: new Date() } : {}),
        ...(sonrakiBakim ? { sonrakiBakimTarihi: sonrakiBakim } : {}),
        ...(durum === "DEVAM_EDIYOR" ? { envanterDurumu: "BAKIMDA", operasyonDurumu: "BAKIMDA" } : {}),
      },
    });
  });

  await auditKaydet(session, "BAKIM_OLUSTUR", {
    varlik: "MaintenanceRecord",
    detay: { vehicleId, durum },
  });

  revalidatePath("/bakim");
  revalidatePath("/araclar");
  redirect("/bakim");
}

// ── YAKIT (Excel: Yakıt Takip — tutar = litre × birim fiyat, server-side) ────

export async function yakitOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);

  const litre = sayi(formData.get("litre")) ?? 0;
  const birimFiyat = sayi(formData.get("birimFiyat")) ?? 0;
  const sayac = sayi(formData.get("sayac"));
  const vehicleId = String(formData.get("vehicleId"));

  await prisma.$transaction(async (tx) => {
    await tx.fuelRecord.create({
      data: {
        vehicleId,
        tarih: tarih(formData.get("tarih")) ?? new Date(),
        yakitTuru: (bosIseUndefined(formData.get("yakitTuru")) ?? "MOTORIN") as never,
        litre,
        birimFiyat,
        tutar: yakitTutari(litre, birimFiyat), // Excel H sütunu formülü
        sayac,
        sorumluPersonelId: bosIseUndefined(formData.get("sorumluPersonelId")),
        vehicleTaskId: bosIseUndefined(formData.get("vehicleTaskId")),
      },
    });
    if (sayac) {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { sayacDeger: sayac } });
    }
  });

  await auditKaydet(session, "YAKIT_OLUSTUR", {
    varlik: "FuelRecord",
    detay: { vehicleId, litre, birimFiyat },
  });

  revalidatePath("/yakit");
  redirect("/yakit");
}
