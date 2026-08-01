import { prisma } from "@kars/db";
import { betonGuncelStok, betonStokDurumu, type BetonStokDurum } from "@kars/shared";

/**
 * `ConcreteStock.malzeme` metin anahtarı ile `ConcreteProduction` snapshot
 * kolonları arasındaki eşleme. Web sayfası ve `/api/v1/concrete` aynı kaynağı
 * kullanır; ayrışırsa stok çıkışları sessizce sıfır görünür.
 */
const URETIM_KOLONU = {
  Cimento: "cimentoKg",
  Kum: "kumKg",
  "Micir 0-5mm": "micir05Kg",
  "Micir 5-12mm": "micir512Kg",
  "Micir 12-19mm": "micir1219Kg",
  Su: "suLt",
  Katki: "katkiKg",
} as const satisfies Record<string, string>;

export type UretimToplami = {
  cimentoKg: number | null;
  kumKg: number | null;
  micir05Kg: number | null;
  micir512Kg: number | null;
  micir1219Kg: number | null;
  suLt: number | null;
  katkiKg: number | null;
};

export function uretimCikisHaritasi(sum: UretimToplami): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [malzeme, kolon] of Object.entries(URETIM_KOLONU)) {
    out[malzeme] = sum[kolon as keyof UretimToplami] ?? 0;
  }
  return out;
}

export async function uretimToplamlari(): Promise<Record<string, number>> {
  const { _sum } = await prisma.concreteProduction.aggregate({
    _sum: {
      cimentoKg: true,
      kumKg: true,
      micir05Kg: true,
      micir512Kg: true,
      micir1219Kg: true,
      suLt: true,
      katkiKg: true,
    },
  });
  return uretimCikisHaritasi(_sum);
}

export type StokSatiri = {
  baslangicStok: number;
  toplamGiris: number;
  kritikSeviye: number;
  malzeme: string;
};

export function stokHesapla(
  s: StokSatiri,
  cikisMap: Record<string, number>,
): { cikis: number; kalanStok: number; durum: BetonStokDurum } {
  const cikis = cikisMap[s.malzeme] ?? 0;
  const kalanStok = betonGuncelStok(s.baslangicStok, s.toplamGiris, cikis);
  return { cikis, kalanStok, durum: betonStokDurumu(kalanStok, s.kritikSeviye) };
}
