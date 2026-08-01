import { prisma } from "@kars/db";
import {
  AY_ADLARI,
  gercekTuketim,
  ortBirimFiyat,
  sayacFarkiMaxMin,
  tuketimDurumu,
  YAKIT_TIPI_LABELS,
} from "@kars/shared";

export const AY_LISTESI = [...AY_ADLARI];

type AyAdi = (typeof AY_ADLARI)[number];

/** `departmentScope` hem tek id hem `{ in: [] }` biçiminde kapsam döndürebilir. */
type DepartmentFilter = string | { in: string[] } | null | undefined;

export type AkaryakitAnalizSatiri = {
  vehicleId: string;
  plaka: string;
  mudurluk: string | null;
  sayacTipi: "KM" | "SAAT";
  toplamLitre: number;
  toplamTutar: number;
  sayacFarki: number;
  gercekTuketim: number | null;
  norm: number;
  durum: string | null;
};

export type AkaryakitAylikSatiri = {
  vehicleId: string;
  plaka: string;
  yakit: string;
  litre: number;
  tutar: number;
  adet: number;
  ortBirimFiyat: number | null;
};

export type AkaryakitAnaliz = {
  ay: string;
  ayIndex: number;
  analiz: AkaryakitAnalizSatiri[];
  aylik: AkaryakitAylikSatiri[];
  toplam: { litre: number; tutar: number; adet: number };
};

/** Geçerli ay adını döndürür; geçersiz/boş girdide içinde bulunulan ay. */
export function ayNormalize(ay?: string | null): AyAdi {
  return ay && (AY_LISTESI as string[]).includes(ay)
    ? (ay as AyAdi)
    : AY_LISTESI[new Date().getMonth()];
}

/**
 * Akaryakıt tüketim analizi ve aylık rapor. Web sayfası ve `/api/v1/akaryakit`
 * aynı fonksiyonu çağırır; formüller [@kars/shared] içindeki Excel karşılıklarıdır.
 */
export async function akaryakitAnalizi(opts: {
  departmentId?: DepartmentFilter;
  ay?: string | null;
}): Promise<AkaryakitAnaliz> {
  const ay = ayNormalize(opts.ay);
  const ayIndex = AY_LISTESI.indexOf(ay);
  const departmentId = opts.departmentId ?? undefined;

  const [araclar, kayitlar] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        envanterDurumu: { not: "HURDAYA_AYRILDI" },
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: true },
      orderBy: { plaka: "asc" },
    }),
    prisma.fuelRecord.findMany({
      where: departmentId ? { vehicle: { departmentId } } : undefined,
      include: { vehicle: true },
    }),
  ]);

  const analiz = araclar.map((a) => {
    const rows = kayitlar.filter((k) => k.vehicleId === a.id);
    const toplamLitre = rows.reduce((s, r) => s + Number(r.litre), 0);
    const toplamTutar = rows.reduce((s, r) => s + Number(r.tutar), 0);
    const sayaclar = rows
      .map((r) => (r.sayac == null ? null : Number(r.sayac)))
      .filter((s): s is number => s != null);
    const sayacFarki = sayacFarkiMaxMin(sayaclar);
    const sayacTipi =
      a.sayacTipi === "SAAT" || a.sayacBirim === "SAAT" ? ("SAAT" as const) : ("KM" as const);
    const gercek = gercekTuketim(toplamLitre, sayacFarki, sayacTipi);
    const norm = a.normTuketim == null ? 0 : Number(a.normTuketim);
    return {
      vehicleId: a.id,
      plaka: a.plaka,
      mudurluk: a.department?.shortName ?? a.department?.name ?? null,
      sayacTipi,
      toplamLitre,
      toplamTutar,
      sayacFarki,
      gercekTuketim: gercek,
      norm,
      durum: gercek != null && norm > 0 ? tuketimDurumu(gercek, norm) : null,
    };
  });

  const aylik = araclar.map((a) => {
    const rows = kayitlar.filter(
      (k) => k.vehicleId === a.id && (ayIndex < 0 || k.tarih.getMonth() === ayIndex),
    );
    const litre = rows.reduce((s, r) => s + Number(r.litre), 0);
    const tutar = rows.reduce((s, r) => s + Number(r.tutar), 0);
    return {
      vehicleId: a.id,
      plaka: a.plaka,
      yakit: a.yakitTipi ? (YAKIT_TIPI_LABELS[a.yakitTipi] ?? a.yakitTipi) : "—",
      litre,
      tutar,
      adet: rows.length,
      ortBirimFiyat: ortBirimFiyat(tutar, litre),
    };
  });

  return {
    ay,
    ayIndex,
    analiz,
    aylik,
    toplam: {
      litre: aylik.reduce((s, r) => s + r.litre, 0),
      tutar: aylik.reduce((s, r) => s + r.tutar, 0),
      adet: aylik.reduce((s, r) => s + r.adet, 0),
    },
  };
}
