"use server";

import { revalidatePath } from "next/cache";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import {
  aracGunlukGuncelleForUser,
  aracGunlukOlusturForUser,
  aracGunlukSilForUser,
  personelGunlukGuncelleForUser,
  personelGunlukOlusturForUser,
  personelGunlukSilForUser,
} from "@/lib/domain/worklogs";

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
  await personelGunlukOlusturForUser(session, {
    personnelId: String(formData.get("personnelId")),
    tarih: String(formData.get("tarih")),
    girisSaati: String(formData.get("girisSaati")),
    cikisSaati: String(formData.get("cikisSaati")),
    calismaTipi: bos(formData.get("calismaTipi")),
    yapilanIs: bos(formData.get("yapilanIs")),
    gorevlendirilenBirimId: bos(formData.get("gorevlendirilenBirimId")),
    notlar: bos(formData.get("notlar")),
    onaylayanId: bos(formData.get("onaylayanId")),
  });
  revalidatePath("/gunluk-calisma");
}

export async function personelGunlukGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);
  await personelGunlukGuncelleForUser(session, {
    id: String(formData.get("id") ?? "").trim(),
    personnelId: String(formData.get("personnelId")),
    tarih: String(formData.get("tarih")),
    girisSaati: String(formData.get("girisSaati")),
    cikisSaati: String(formData.get("cikisSaati")),
    calismaTipi: bos(formData.get("calismaTipi")),
    yapilanIs: bos(formData.get("yapilanIs")),
    gorevlendirilenBirimId: bos(formData.get("gorevlendirilenBirimId")),
    notlar: bos(formData.get("notlar")),
    onaylayanId: bos(formData.get("onaylayanId")),
  });
  revalidatePath("/gunluk-calisma");
}

export async function personelGunlukSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);
  await personelGunlukSilForUser(session, String(formData.get("id") ?? "").trim());
  revalidatePath("/gunluk-calisma");
}

export async function aracGunlukOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);
  await aracGunlukOlusturForUser(session, {
    vehicleId: String(formData.get("vehicleId")),
    tarih: String(formData.get("tarih")),
    girisSaati: String(formData.get("girisSaati")),
    cikisSaati: String(formData.get("cikisSaati")),
    driverId: bos(formData.get("driverId")),
    soforAdi: bos(formData.get("soforAdi")),
    gorevTanimi: bos(formData.get("gorevTanimi")),
    yerBolge: bos(formData.get("yerBolge")),
    yakitLitre: sayi(formData.get("yakitLitre")),
    birimFiyat: sayi(formData.get("birimFiyat")),
    yakitTuru: bos(formData.get("yakitTuru")),
    notlar: bos(formData.get("notlar")),
    onaylayanId: bos(formData.get("onaylayanId")),
  });
  revalidatePath("/gunluk-calisma");
  revalidatePath("/yakit");
}

export async function aracGunlukGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);
  await aracGunlukGuncelleForUser(session, {
    id: String(formData.get("id") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId")),
    tarih: String(formData.get("tarih")),
    girisSaati: String(formData.get("girisSaati")),
    cikisSaati: String(formData.get("cikisSaati")),
    driverId: bos(formData.get("driverId")),
    soforAdi: bos(formData.get("soforAdi")),
    gorevTanimi: bos(formData.get("gorevTanimi")),
    yerBolge: bos(formData.get("yerBolge")),
    yakitLitre: sayi(formData.get("yakitLitre")),
    birimFiyat: sayi(formData.get("birimFiyat")),
    yakitTuru: bos(formData.get("yakitTuru")),
    notlar: bos(formData.get("notlar")),
    onaylayanId: bos(formData.get("onaylayanId")),
  });
  revalidatePath("/gunluk-calisma");
  revalidatePath("/yakit");
}

export async function aracGunlukSil(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.worklogs);
  await aracGunlukSilForUser(session, String(formData.get("id") ?? "").trim());
  revalidatePath("/gunluk-calisma");
  revalidatePath("/yakit");
}
