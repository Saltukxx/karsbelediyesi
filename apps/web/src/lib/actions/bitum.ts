"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import {
  bitumSeferMaliyeti,
  bitumTonTasima,
  bitumTirSefer,
  bitumAlisMaliyeti,
  bitumVarisMaliyetiTon,
  bitumToplamMaliyet,
} from "@kars/shared";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}

export async function bitumAyarKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.bitum);

  const mesafeKm = sayi(formData.get("mesafeKm")) ?? 185;
  const yakitTlKm = sayi(formData.get("yakitTlKm")) ?? 45;
  const tirKapasiteTon = sayi(formData.get("tirKapasiteTon")) ?? 30;
  const seferMaliyetiTl = bitumSeferMaliyeti(mesafeKm, yakitTlKm);
  const tonTasimaTl = bitumTonTasima(seferMaliyetiTl, tirKapasiteTon);

  await prisma.bitumSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      depoKapasitesiTon: sayi(formData.get("depoKapasitesiTon")) ?? 80,
      mesafeKm,
      tirKapasiteTon,
      yakitTlKm,
      seferMaliyetiTl,
      tonTasimaTl,
      referansAlisFiyat: sayi(formData.get("referansAlisFiyat")) ?? 18000,
      kritikEsik: sayi(formData.get("kritikEsik")) ?? 0.2,
      dusukEsik: sayi(formData.get("dusukEsik")) ?? 0.4,
    },
    update: {
      depoKapasitesiTon: sayi(formData.get("depoKapasitesiTon")) ?? 80,
      mesafeKm,
      tirKapasiteTon,
      yakitTlKm,
      seferMaliyetiTl,
      tonTasimaTl,
      referansAlisFiyat: sayi(formData.get("referansAlisFiyat")) ?? 18000,
      kritikEsik: sayi(formData.get("kritikEsik")) ?? 0.2,
      dusukEsik: sayi(formData.get("dusukEsik")) ?? 0.4,
    },
  });
  await auditKaydet(session, "BITUM_AYAR_KAYDET", { varlik: "BitumSettings" });
  revalidatePath("/bitum");
}

export async function bitumHareketOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.bitum);

  const tip = String(formData.get("tip")) as "ALIS" | "TASIMA" | "KULLANIM";
  const miktarTon = sayi(formData.get("miktarTon")) ?? 0;
  const settings = await prisma.bitumSettings.findUniqueOrThrow({ where: { id: "default" } });

  let alisFiyati = sayi(formData.get("alisFiyati"));
  let alisMaliyeti: number | undefined;
  let tirSeferSayisi: number | undefined;
  let tasimaMaliyeti: number | undefined;
  let kaynakOrtFiyat: number | undefined;
  let varisMaliyetiTon: number | undefined;
  let toplamMaliyet: number | undefined;

  const depoId = bos(formData.get("depoId"));
  const kaynakDepoId = bos(formData.get("kaynakDepoId"));
  const hedefDepoId = bos(formData.get("hedefDepoId"));
  const kullanimDepoId = bos(formData.get("kullanimDepoId"));

  if (tip === "ALIS") {
    alisFiyati = alisFiyati ?? settings.referansAlisFiyat;
    alisMaliyeti = bitumAlisMaliyeti(miktarTon, alisFiyati);
    toplamMaliyet = bitumToplamMaliyet("ALIS", alisMaliyeti, miktarTon, null) ?? undefined;
  } else if (tip === "TASIMA") {
    tirSeferSayisi = bitumTirSefer(miktarTon, settings.tirKapasiteTon);
    tasimaMaliyeti = tirSeferSayisi * settings.seferMaliyetiTl;

    // Kaynak depodaki alışların ağırlıklı ort. fiyatı (Excel SUMIFS)
    if (kaynakDepoId) {
      const alislar = await prisma.bitumMovement.findMany({
        where: { tip: "ALIS", depoId: kaynakDepoId },
      });
      const ton = alislar.reduce((s, a) => s + a.miktarTon, 0);
      const maliyet = alislar.reduce((s, a) => s + (a.alisMaliyeti ?? 0), 0);
      kaynakOrtFiyat = ton > 0 ? maliyet / ton : settings.referansAlisFiyat;
    } else {
      kaynakOrtFiyat = settings.referansAlisFiyat;
    }

    varisMaliyetiTon = bitumVarisMaliyetiTon(
      kaynakOrtFiyat,
      tasimaMaliyeti,
      miktarTon,
    );
    toplamMaliyet = bitumToplamMaliyet("TASIMA", null, miktarTon, varisMaliyetiTon) ?? undefined;
  }

  await prisma.bitumMovement.create({
    data: {
      tarih: new Date(String(formData.get("tarih"))),
      tip,
      depoId: tip === "ALIS" ? depoId : undefined,
      kaynakDepoId: tip === "TASIMA" ? kaynakDepoId : undefined,
      hedefDepoId: tip === "TASIMA" ? hedefDepoId : undefined,
      kullanimDepoId: tip === "KULLANIM" ? kullanimDepoId : undefined,
      miktarTon,
      alisFiyati,
      alisMaliyeti,
      tirSeferSayisi,
      tasimaMaliyeti,
      kaynakOrtFiyat,
      varisMaliyetiTon,
      toplamMaliyet,
      aciklama: bos(formData.get("aciklama")),
    },
  });

  await auditKaydet(session, "BITUM_HAREKET_OLUSTUR", {
    varlik: "BitumMovement",
    detay: { tip, miktarTon },
  });

  revalidatePath("/bitum");
}
