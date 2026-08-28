import { prisma } from "@kars/db";
import type { BakimDurum, BakimTuru, PersonelDurum, StokHareketTipi, YakitTuru } from "@kars/db";
import {
  normalSaatHesapla,
  mesaiSaatHesapla,
  toplamSaatHesapla,
  yakitTutari,
  betonUretimMalzeme,
} from "@kars/shared";
import { ACTION_ROLES, assertRole, type SessionUser } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { gorevIziAnalizEt } from "@/lib/route-analysis";
import { canAccessTask, loadTaskForAccess, toAccessUser } from "@/lib/access";

export async function aracOlusturForUser(
  user: SessionUser,
  input: { plaka: string; marka?: string; model?: string; departmentId?: string; vehicleTypeId?: string },
) {
  assertRole(user, ACTION_ROLES.vehicles);
  const plaka = input.plaka.trim().toUpperCase();
  if (!plaka) throw new Error("Plaka zorunlu");
  const arac = await prisma.vehicle.create({
    data: {
      plaka,
      marka: input.marka,
      model: input.model,
      departmentId: user.role === "DEPARTMENT_MANAGER" ? user.departmentId : input.departmentId,
      vehicleTypeId: input.vehicleTypeId,
      envanterDurumu: "AKTIF",
      operasyonDurumu: "MUSAIT",
    },
  });
  await auditKaydet({ user }, "ARAC_OLUSTUR", {
    varlik: "Vehicle",
    varlikId: arac.id,
    detay: { plaka },
  });
  return arac;
}

export async function aracHurdayaAyirForUser(user: SessionUser, id: string) {
  assertRole(user, ACTION_ROLES.vehicles);
  const arac = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, plaka: true, envanterDurumu: true },
  });
  if (!arac) throw new Error("Araç bulunamadı");
  const acik = await prisma.vehicleTask.count({
    where: { vehicleId: id, durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] } },
  });
  if (acik > 0) throw new Error("Açık görevi olan araç hurdaya ayrılamaz");
  await prisma.vehicle.update({
    where: { id },
    data: { envanterDurumu: "HURDAYA_AYRILDI", operasyonDurumu: "ARIZALI" },
  });
  await auditKaydet({ user }, "ARAC_HURDAYA", { varlik: "Vehicle", varlikId: id });
  return { ok: true };
}

export async function bakimOlusturForUser(
  user: SessionUser,
  input: {
    vehicleId: string;
    bakimTuru?: BakimTuru;
    yapilanIslemler?: string;
    maliyet?: number;
    durum?: BakimDurum;
  },
) {
  assertRole(user, ACTION_ROLES.vehicles);
  if (!input.vehicleId) throw new Error("Araç zorunlu");
  const rec = await prisma.maintenanceRecord.create({
    data: {
      vehicleId: input.vehicleId,
      bakimTarihi: new Date(),
      bakimTuru: input.bakimTuru ?? "PERIYODIK",
      yapilanIslemler: input.yapilanIslemler,
      maliyet: input.maliyet,
      durum: input.durum ?? "PLANLANDI",
    },
  });
  await auditKaydet({ user }, "BAKIM_OLUSTUR", {
    varlik: "MaintenanceRecord",
    varlikId: rec.id,
    detay: { vehicleId: input.vehicleId },
  });
  return rec;
}

export async function yakitOlusturForUser(
  user: SessionUser,
  input: {
    vehicleId: string;
    litre: number;
    birimFiyat: number;
    sayac?: number;
    yakitTuru?: YakitTuru;
  },
) {
  assertRole(user, ACTION_ROLES.fuel);
  if (!input.vehicleId) throw new Error("Araç zorunlu");
  if (!(input.litre > 0)) throw new Error("Litre zorunlu");
  const tutar = yakitTutari(input.litre, input.birimFiyat);
  const rec = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelRecord.create({
      data: {
        vehicleId: input.vehicleId,
        tarih: new Date(),
        yakitTuru: input.yakitTuru ?? "MOTORIN",
        litre: input.litre,
        birimFiyat: input.birimFiyat,
        tutar,
        sayac: input.sayac,
      },
    });
    if (input.sayac != null) {
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { sayacDeger: input.sayac },
      });
    }
    return created;
  });
  await auditKaydet({ user }, "YAKIT_OLUSTUR", {
    varlik: "FuelRecord",
    varlikId: rec.id,
  });
  return rec;
}

export async function malzemeOlusturForUser(
  user: SessionUser,
  input: {
    kod: string;
    ad: string;
    kategori: string;
    birim: string;
    depoLokasyon?: string;
    kritikStok?: number;
    birimFiyat?: number;
    aciklama?: string;
  },
) {
  assertRole(user, ACTION_ROLES.materials);
  if (!input.kod?.trim() || !input.ad?.trim()) throw new Error("Kod ve ad zorunlu");
  const malzeme = await prisma.material.create({
    data: {
      kod: input.kod.trim(),
      ad: input.ad.trim(),
      kategori: input.kategori?.trim() || "GENEL",
      birim: input.birim?.trim() || "ADET",
      depoLokasyon: input.depoLokasyon,
      kritikStok: input.kritikStok ?? 0,
      birimFiyat: input.birimFiyat,
      aciklama: input.aciklama,
    },
  });
  await auditKaydet({ user }, "MALZEME_OLUSTUR", {
    varlik: "Material",
    varlikId: malzeme.id,
    detay: { kod: malzeme.kod, ad: malzeme.ad },
  });
  return malzeme;
}

export async function stokHareketOlusturForUser(
  user: SessionUser,
  input: { materialId: string; tip: StokHareketTipi; miktar: number; aciklama?: string },
) {
  assertRole(user, ACTION_ROLES.materials);
  if (!input.materialId) throw new Error("Malzeme zorunlu");
  if (!(input.miktar > 0)) throw new Error("Miktar zorunlu");
  const tip = input.tip === "CIKIS" ? "CIKIS" : "GIRIS";
  const rec = await prisma.materialMovement.create({
    data: {
      materialId: input.materialId,
      tarih: new Date(),
      tip,
      miktar: input.miktar,
      aciklama: input.aciklama,
      departmentId: user.departmentId,
    },
  });
  await auditKaydet({ user }, "STOK_HAREKET", {
    varlik: "MaterialMovement",
    varlikId: rec.id,
  });
  return rec;
}

export async function personelOlusturForUser(
  user: SessionUser,
  input: { adSoyad: string; unvan?: string; departmentId?: string; telefon?: string; durum?: PersonelDurum },
) {
  assertRole(user, ACTION_ROLES.personnel);
  const adSoyad = input.adSoyad.trim();
  if (!adSoyad) throw new Error("Ad soyad zorunlu");
  let departmentId = input.departmentId;
  if (user.role === "DEPARTMENT_MANAGER") {
    if (!user.departmentId) throw new Error("Yetkisiz");
    departmentId = user.departmentId;
  }
  const personel = await prisma.personnel.create({
    data: {
      adSoyad,
      unvan: input.unvan,
      departmentId,
      telefon: input.telefon,
      durum: input.durum === "IZINLI" || input.durum === "RAPORLU" ? input.durum : "AKTIF",
    },
  });
  await auditKaydet({ user }, "PERSONEL_OLUSTUR", {
    varlik: "Personnel",
    varlikId: personel.id,
    detay: { adSoyad },
  });
  return personel;
}

export async function personelPasifeAlForUser(user: SessionUser, id: string) {
  assertRole(user, ACTION_ROLES.personnel);
  const mevcut = await prisma.personnel.findUnique({ where: { id } });
  if (!mevcut) throw new Error("Personel bulunamadı");
  if (user.role === "DEPARTMENT_MANAGER" && mevcut.departmentId !== user.departmentId) {
    throw new Error("Yetkisiz");
  }
  await prisma.personnel.update({ where: { id }, data: { durum: "AYRILDI" } });
  await auditKaydet({ user }, "PERSONEL_PASIFE_AL", { varlik: "Personnel", varlikId: id });
  return { ok: true };
}

export async function personelGunlukOlusturForUser(
  user: SessionUser,
  input: {
    personnelId: string;
    tarih: string;
    girisSaati: string;
    cikisSaati: string;
    calismaTipi?: string;
    yapilanIs?: string;
  },
) {
  assertRole(user, ACTION_ROLES.worklogs);
  if (!input.personnelId || !input.tarih || !input.girisSaati || !input.cikisSaati) {
    throw new Error("Personel, tarih ve saatler zorunlu");
  }
  const rec = await prisma.personnelWorkLog.create({
    data: {
      personnelId: input.personnelId,
      tarih: new Date(input.tarih),
      girisSaati: input.girisSaati,
      cikisSaati: input.cikisSaati,
      normalSaat: normalSaatHesapla(input.girisSaati, input.cikisSaati),
      mesaiSaat: mesaiSaatHesapla(input.girisSaati, input.cikisSaati),
      toplamSaat: toplamSaatHesapla(input.girisSaati, input.cikisSaati),
      calismaTipi: (input.calismaTipi ?? "NORMAL_MESAI") as never,
      yapilanIs: input.yapilanIs,
    },
  });
  await auditKaydet({ user }, "PERSONEL_GUNLUK_OLUSTUR", {
    varlik: "PersonnelWorkLog",
    varlikId: rec.id,
  });
  return rec;
}

export async function betonUretimForUser(
  user: SessionUser,
  input: { recipeId: string; hedefM3: number; tarih?: string; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.concrete);
  if (!input.recipeId || !(input.hedefM3 > 0)) throw new Error("Reçete ve m³ zorunlu");
  const recipe = await prisma.concreteRecipe.findUniqueOrThrow({ where: { id: input.recipeId } });
  const rec = await prisma.concreteProduction.create({
    data: {
      tarih: input.tarih ? new Date(input.tarih) : new Date(),
      recipeId: input.recipeId,
      hedefM3: input.hedefM3,
      cimentoKg: betonUretimMalzeme(input.hedefM3, recipe.cimentoKg),
      kumKg: betonUretimMalzeme(input.hedefM3, recipe.kumKg),
      micir05Kg: betonUretimMalzeme(input.hedefM3, recipe.micir05Kg),
      micir512Kg: betonUretimMalzeme(input.hedefM3, recipe.micir512Kg),
      micir1219Kg: betonUretimMalzeme(input.hedefM3, recipe.micir1219Kg),
      suLt: betonUretimMalzeme(input.hedefM3, recipe.suLt),
      katkiKg: betonUretimMalzeme(input.hedefM3, recipe.katkiKg),
      notlar: input.notlar,
    },
  });
  await auditKaydet({ user }, "BETON_URETIM", {
    varlik: "ConcreteProduction",
    varlikId: rec.id,
  });
  return rec;
}

export async function bitumHareketForUser(
  user: SessionUser,
  input: { depoId: string; miktarTon: number; tip?: "ALIS" | "KULLANIM"; aciklama?: string },
) {
  assertRole(user, ACTION_ROLES.bitum);
  if (!input.depoId || !(input.miktarTon > 0)) throw new Error("Depo ve miktar zorunlu");
  const tip = input.tip === "KULLANIM" ? "KULLANIM" : "ALIS";
  const rec = await prisma.bitumMovement.create({
    data: {
      tarih: new Date(),
      tip,
      depoId: input.depoId,
      miktarTon: input.miktarTon,
      aciklama: input.aciklama,
    },
  });
  await auditKaydet({ user }, "BITUM_HAREKET", { varlik: "BitumMovement", varlikId: rec.id });
  return rec;
}

export async function mahalleOlusturForUser(user: SessionUser, input: { name: string }) {
  assertRole(user, ACTION_ROLES.definitions);
  const name = input.name.trim();
  if (!name) throw new Error("Ad zorunlu");
  const row = await prisma.neighborhood.create({ data: { name } });
  await auditKaydet({ user }, "MAHALLE_OLUSTUR", { varlik: "Neighborhood", varlikId: row.id });
  return row;
}

export async function mudurlukOlusturForUser(
  user: SessionUser,
  input: { name: string; shortName?: string },
) {
  assertRole(user, ACTION_ROLES.definitions);
  const name = input.name.trim();
  if (!name) throw new Error("Ad zorunlu");
  const row = await prisma.department.create({
    data: { name, shortName: input.shortName?.trim() || name.slice(0, 20) },
  });
  await auditKaydet({ user }, "MUDURLUK_OLUSTUR", { varlik: "Department", varlikId: row.id });
  return row;
}

export async function sikayetTuruOlusturForUser(
  user: SessionUser,
  input: { name: string; defaultDepartmentId?: string },
) {
  assertRole(user, ACTION_ROLES.definitions);
  const name = input.name.trim();
  if (!name) throw new Error("Ad zorunlu");
  const row = await prisma.complaintType.create({
    data: { name, defaultDepartmentId: input.defaultDepartmentId },
  });
  await auditKaydet({ user }, "SIKAYET_TURU_OLUSTUR", { varlik: "ComplaintType", varlikId: row.id });
  return row;
}

export async function gorevYenidenAnalizForUser(user: SessionUser, id: string) {
  assertRole(user, ACTION_ROLES.tasks);
  const gorev = await loadTaskForAccess(id);
  if (!gorev || !canAccessTask(toAccessUser(user as never), gorev)) {
    throw new Error("Yetkisiz");
  }
  const sonuc = await gorevIziAnalizEt(id);
  if (!sonuc) throw new Error("Bu görev bir dispatch rotasına bağlı değil — analiz yapılamaz");
  await auditKaydet({ user }, "GOREV_TAKIP_ANALIZ", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo, sonuc: sonuc.sonuc },
  });
  return sonuc;
}

export async function denetimListesiForUser(user: SessionUser, limit = 200) {
  assertRole(user, ACTION_ROLES.definitions);
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      userAd: true,
      rol: true,
      islem: true,
      varlik: true,
      varlikId: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
