import type { Prisma } from "@kars/db";
import { gun, iso, num } from "@/lib/api/serialize";

type AracKaydi = Prisma.VehicleGetPayload<{
  include: {
    vehicleType: { select: { name: true } };
    department: { select: { name: true } };
    atananSofor: { select: { id: true; name: true } };
  };
}>;

/** Liste satırı: web `/araclar` tablosunun gösterdiği kolonlar. */
export function aracOzet(v: AracKaydi) {
  return {
    id: v.id,
    plaka: v.plaka,
    ad: v.ad,
    marka: v.marka,
    model: v.model,
    modelYili: v.modelYili,
    cins: v.vehicleType?.name ?? null,
    vehicleTypeId: v.vehicleTypeId,
    mudurluk: v.department?.name ?? null,
    departmentId: v.departmentId,
    envanterDurumu: v.envanterDurumu,
    operasyonDurumu: v.operasyonDurumu,
    sayacDeger: num(v.sayacDeger),
    // sayacBirim serbest metin kolonu; sayacTipi ondan türetilen kanonik enum
    sayacBirim: v.sayacTipi,
    sayacTipi: v.sayacTipi,
    atananSoforId: v.atananSoforId,
    atananSoforAdi: v.atananSofor?.name ?? null,
    muayeneTarihi: gun(v.muayeneTarihi),
    sigortaBitis: gun(v.sigortaBitis),
    sonrakiBakimTarihi: gun(v.sonrakiBakimTarihi),
  };
}

/** Detay: `/araclar/[id]` formunun tüm alanları. */
export function aracDetay(v: AracKaydi) {
  return {
    ...aracOzet(v),
    yakitTipi: v.yakitTipi,
    kapasite: v.kapasite,
    normTuketim: num(v.normTuketim),
    bakimKmSaati: v.bakimKmSaati,
    sonBakimTarihi: gun(v.sonBakimTarihi),
    notlar: v.notlar,
    sonKonumLat: v.sonKonumLat,
    sonKonumLng: v.sonKonumLng,
    sonKonumZamani: iso(v.sonKonumZamani),
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
  };
}

export const ARAC_INCLUDE = {
  vehicleType: { select: { name: true } },
  department: { select: { name: true } },
  atananSofor: { select: { id: true, name: true } },
} as const;
