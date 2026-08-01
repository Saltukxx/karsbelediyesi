import { z } from "zod";
import { opsiyonelTarih, sayiAlani, ServiceError } from "@/lib/services/base";

/**
 * Kış / çöp / temizlik ve harita rotalarının ortak alanları. Web formu
 * koordinatları JSON metni olarak gönderir, mobil istemci gerçek dizi
 * gönderir; ikisi de aynı şemadan geçer.
 */
const koordinatCifti = z.tuple([
  z.number().finite().min(-90).max(90),
  z.number().finite().min(-180).max(180),
]);

export const koordinatlarAlani = z
  .union([z.string().trim().min(1), z.array(z.unknown())])
  .transform((v, ctx) => {
    if (typeof v !== "string") return v as unknown;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Koordinat formatı geçersiz",
      });
      return z.NEVER;
    }
  })
  .pipe(z.array(koordinatCifti).min(2, "En az 2 geçerli koordinat gerekli"));

/** Öncelik 1 (en acil) – 3 arasına sıkıştırılır; web formunun davranışı. */
export const oncelikAlani = sayiAlani(z.number())
  .transform((v) => Math.min(Math.max(Math.round(v), 1), 3))
  .default(2);

export const opsiyonelOncelik = oncelikAlani.optional();

/** Operasyon/toplama kaydının zaman aralığı; başlangıç boşsa "şimdi". */
export const zamanAraligiSchema = z.object({
  baslangic: opsiyonelTarih(),
  bitis: opsiyonelTarih(),
});

export function zamanAraligi(data: { baslangic?: Date; bitis?: Date }): {
  baslangic: Date;
  bitis?: Date;
} {
  const baslangic = data.baslangic ?? new Date();
  if (data.bitis && data.bitis < baslangic) {
    throw new ServiceError("Bitiş başlangıçtan önce olamaz");
  }
  return { baslangic, bitis: data.bitis };
}
