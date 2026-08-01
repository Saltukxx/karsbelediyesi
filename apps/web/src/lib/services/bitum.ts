import { z } from "zod";
import { BitumHareketTipi, prisma } from "@kars/db";
import {
  bitumAlisMaliyeti,
  bitumSeferMaliyeti,
  bitumTirSefer,
  bitumTonTasima,
  bitumToplamMaliyet,
  bitumVarisMaliyetiTon,
} from "@kars/shared";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import {
  bosIse,
  opsiyonelMetin,
  opsiyonelSayi,
  rolGerekli,
  sayiAlani,
  ServiceError,
  type ServiceActor,
  tarihAlani,
} from "@/lib/services/base";

const AYAR_ID = "default";

function ayar(varsayilan: number) {
  return bosIse(sayiAlani(z.number().nonnegative()).default(varsayilan));
}

export const bitumAyarInputSchema = z.object({
  depoKapasitesiTon: ayar(80),
  mesafeKm: ayar(185),
  tirKapasiteTon: bosIse(sayiAlani(z.number().positive()).default(30)),
  yakitTlKm: ayar(45),
  referansAlisFiyat: ayar(18000),
  kritikEsik: ayar(0.2),
  dusukEsik: ayar(0.4),
});

export type BitumAyarInput = z.input<typeof bitumAyarInputSchema>;

export async function bitumAyarKaydet(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.bitum);
  const data = bitumAyarInputSchema.parse(input);

  // Sefer ve ton taşıma maliyeti türetilmiş alanlar; istemciden alınmaz
  const seferMaliyetiTl = bitumSeferMaliyeti(data.mesafeKm, data.yakitTlKm);
  const alanlar = {
    ...data,
    seferMaliyetiTl,
    tonTasimaTl: bitumTonTasima(seferMaliyetiTl, data.tirKapasiteTon),
  };

  const ayarlar = await prisma.bitumSettings.upsert({
    where: { id: AYAR_ID },
    create: { id: AYAR_ID, ...alanlar },
    update: alanlar,
  });

  await auditKaydet(actor, "BITUM_AYAR_KAYDET", {
    varlik: "BitumSettings",
    varlikId: AYAR_ID,
  });
  return ayarlar;
}

export const bitumHareketInputSchema = z.object({
  tip: z.nativeEnum(BitumHareketTipi),
  tarih: tarihAlani(),
  miktarTon: sayiAlani(z.number().positive("Miktar 0'dan büyük olmalı")),
  alisFiyati: opsiyonelSayi(z.number().nonnegative()),
  depoId: opsiyonelMetin,
  kaynakDepoId: opsiyonelMetin,
  hedefDepoId: opsiyonelMetin,
  kullanimDepoId: opsiyonelMetin,
  aciklama: opsiyonelMetin,
});

export type BitumHareketInput = z.input<typeof bitumHareketInputSchema>;

export async function bitumHareketOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.bitum);
  const data = bitumHareketInputSchema.parse(input);

  const settings = await prisma.bitumSettings.findUnique({ where: { id: AYAR_ID } });
  if (!settings) {
    throw new ServiceError("Bitüm ayarları tanımlanmamış", 409);
  }

  const maliyet = await maliyetHesapla(data, settings);

  const hareket = await prisma.bitumMovement.create({
    data: {
      tarih: data.tarih,
      tip: data.tip,
      // Depo alanları hareket tipine göre ayrışır
      depoId: data.tip === BitumHareketTipi.ALIS ? data.depoId : undefined,
      kaynakDepoId: data.tip === BitumHareketTipi.TASIMA ? data.kaynakDepoId : undefined,
      hedefDepoId: data.tip === BitumHareketTipi.TASIMA ? data.hedefDepoId : undefined,
      kullanimDepoId:
        data.tip === BitumHareketTipi.KULLANIM ? data.kullanimDepoId : undefined,
      miktarTon: data.miktarTon,
      aciklama: data.aciklama,
      ...maliyet,
    },
  });

  await auditKaydet(actor, "BITUM_HAREKET_OLUSTUR", {
    varlik: "BitumMovement",
    varlikId: hareket.id,
    detay: { tip: data.tip, miktarTon: data.miktarTon },
  });
  return hareket;
}

type BitumAyarlari = {
  tirKapasiteTon: number;
  seferMaliyetiTl: number;
  referansAlisFiyat: number;
};

type BitumMaliyet = {
  alisFiyati?: number;
  alisMaliyeti?: number;
  tirSeferSayisi?: number;
  tasimaMaliyeti?: number;
  kaynakOrtFiyat?: number;
  varisMaliyetiTon?: number;
  toplamMaliyet?: number;
};

/** Excel modelinin maliyet kolonları; KULLANIM hareketinde maliyet üretilmez. */
async function maliyetHesapla(
  data: z.output<typeof bitumHareketInputSchema>,
  settings: BitumAyarlari,
): Promise<BitumMaliyet> {
  if (data.tip === BitumHareketTipi.ALIS) {
    const alisFiyati = data.alisFiyati ?? settings.referansAlisFiyat;
    const alisMaliyeti = bitumAlisMaliyeti(data.miktarTon, alisFiyati);
    return {
      alisFiyati,
      alisMaliyeti,
      toplamMaliyet:
        bitumToplamMaliyet("ALIS", alisMaliyeti, data.miktarTon, null) ?? undefined,
    };
  }

  if (data.tip === BitumHareketTipi.TASIMA) {
    const tirSeferSayisi = bitumTirSefer(data.miktarTon, settings.tirKapasiteTon);
    const tasimaMaliyeti = tirSeferSayisi * settings.seferMaliyetiTl;
    const kaynakOrtFiyat = await kaynakOrtalamaFiyat(
      data.kaynakDepoId,
      settings.referansAlisFiyat,
    );
    const varisMaliyetiTon = bitumVarisMaliyetiTon(
      kaynakOrtFiyat,
      tasimaMaliyeti,
      data.miktarTon,
    );
    return {
      alisFiyati: data.alisFiyati,
      tirSeferSayisi,
      tasimaMaliyeti,
      kaynakOrtFiyat,
      varisMaliyetiTon,
      toplamMaliyet:
        bitumToplamMaliyet("TASIMA", null, data.miktarTon, varisMaliyetiTon) ??
        undefined,
    };
  }

  return { alisFiyati: data.alisFiyati };
}

/** Kaynak depodaki alışların ağırlıklı ortalama fiyatı (Excel SUMIFS) */
async function kaynakOrtalamaFiyat(
  kaynakDepoId: string | undefined,
  referansAlisFiyat: number,
): Promise<number> {
  if (!kaynakDepoId) return referansAlisFiyat;

  const alislar = await prisma.bitumMovement.findMany({
    where: { tip: BitumHareketTipi.ALIS, depoId: kaynakDepoId },
    select: { miktarTon: true, alisMaliyeti: true },
  });
  const ton = alislar.reduce((s, a) => s + a.miktarTon, 0);
  const maliyet = alislar.reduce((s, a) => s + (a.alisMaliyeti ?? 0), 0);
  return ton > 0 ? maliyet / ton : referansAlisFiyat;
}
