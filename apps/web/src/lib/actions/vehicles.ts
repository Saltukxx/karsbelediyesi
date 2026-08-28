"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import {
  aracGuncelleForUser,
  aracHurdayaAyirForUser,
  aracOlusturForUser,
  bakimGuncelleForUser,
  bakimOlusturForUser,
  bakimSilForUser,
  yakitGuncelleForUser,
  yakitOlusturForUser,
  yakitSilForUser,
} from "@/lib/domain/fleet";

function bosIseUndefined(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function tarih(v: FormDataEntryValue | null): string | undefined {
  return bosIseUndefined(v);
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bosIseUndefined(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

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
  muayeneTarihi: z.string().optional(),
  sigortaBitis: z.string().optional(),
  sonBakimTarihi: z.string().optional(),
  sonrakiBakimTarihi: z.string().optional(),
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
  const arac = await aracOlusturForUser(session, aracVerisi(formData));
  revalidatePath("/araclar");
  redirect(`/araclar/${arac.id}`);
}

export async function aracGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  const id = String(formData.get("id"));
  await aracGuncelleForUser(session, { id, ...aracVerisi(formData) });
  revalidatePath("/araclar");
  revalidatePath(`/araclar/${id}`);
  redirect(`/araclar/${id}`);
}

export async function aracHurdayaAyir(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  const id = String(formData.get("id") ?? "").trim();
  await aracHurdayaAyirForUser(session, id);
  revalidatePath("/araclar");
  revalidatePath(`/araclar/${id}`);
}

export async function bakimOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await bakimOlusturForUser(session, {
    vehicleId: String(formData.get("vehicleId") ?? "").trim(),
    bakimTarihi: tarih(formData.get("bakimTarihi")),
    bakimTuru: bosIseUndefined(formData.get("bakimTuru")),
    yapilanIslemler: bosIseUndefined(formData.get("yapilanIslemler")),
    kullanilanMalzeme: bosIseUndefined(formData.get("kullanilanMalzeme")),
    maliyet: sayi(formData.get("maliyet")),
    yapanFirmaPersonel: bosIseUndefined(formData.get("yapanFirmaPersonel")),
    sonrakiBakimTarihi: tarih(formData.get("sonrakiBakimTarihi")),
    durum: bosIseUndefined(formData.get("durum")),
  });
  revalidatePath("/bakim");
  revalidatePath("/araclar");
  redirect("/bakim");
}

export async function bakimGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await bakimGuncelleForUser(session, {
    id: String(formData.get("id") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId") ?? "").trim(),
    bakimTarihi: tarih(formData.get("bakimTarihi")),
    bakimTuru: bosIseUndefined(formData.get("bakimTuru")),
    yapilanIslemler: bosIseUndefined(formData.get("yapilanIslemler")),
    kullanilanMalzeme: bosIseUndefined(formData.get("kullanilanMalzeme")),
    maliyet: sayi(formData.get("maliyet")),
    yapanFirmaPersonel: bosIseUndefined(formData.get("yapanFirmaPersonel")),
    sonrakiBakimTarihi: tarih(formData.get("sonrakiBakimTarihi")),
    durum: bosIseUndefined(formData.get("durum")),
  });
  revalidatePath("/bakim");
  revalidatePath("/araclar");
  redirect("/bakim");
}

export async function bakimSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await bakimSilForUser(session, String(formData.get("id") ?? "").trim());
  revalidatePath("/bakim");
  revalidatePath("/araclar");
}

export async function yakitOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await yakitOlusturForUser(session, {
    vehicleId: String(formData.get("vehicleId")),
    tarih: tarih(formData.get("tarih")) ?? new Date().toISOString(),
    litre: sayi(formData.get("litre")) ?? 0,
    birimFiyat: sayi(formData.get("birimFiyat")) ?? 0,
    yakitTuru: bosIseUndefined(formData.get("yakitTuru")),
    sayac: sayi(formData.get("sayac")),
    sorumluPersonelId: bosIseUndefined(formData.get("sorumluPersonelId")),
    vehicleTaskId: bosIseUndefined(formData.get("vehicleTaskId")),
  });
  revalidatePath("/yakit");
  redirect("/yakit");
}

export async function yakitGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await yakitGuncelleForUser(session, {
    id: String(formData.get("id") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId")),
    tarih: tarih(formData.get("tarih")) ?? new Date().toISOString(),
    litre: sayi(formData.get("litre")) ?? 0,
    birimFiyat: sayi(formData.get("birimFiyat")) ?? 0,
    yakitTuru: bosIseUndefined(formData.get("yakitTuru")),
    sayac: sayi(formData.get("sayac")),
    sorumluPersonelId: bosIseUndefined(formData.get("sorumluPersonelId")),
    vehicleTaskId: bosIseUndefined(formData.get("vehicleTaskId")),
  });
  revalidatePath("/yakit");
  revalidatePath("/gunluk-calisma");
  redirect("/yakit");
}

export async function yakitSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.vehicles);
  await yakitSilForUser(session, String(formData.get("id") ?? "").trim());
  revalidatePath("/yakit");
  revalidatePath("/gunluk-calisma");
}
