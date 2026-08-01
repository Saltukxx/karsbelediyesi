import type { Prisma } from "@kars/db";

type DecimalLike = Prisma.Decimal | number | null | undefined;

/**
 * Prisma `Decimal` alanları JSON'a string olarak çıkar; istemciler (iOS/web)
 * number bekler. Tüm parasal/ondalık alanlar bu fonksiyondan geçirilir.
 */
export function num(v: DecimalLike): number | null {
  if (v == null) return null;
  return typeof v === "number" ? v : Number(v);
}

/** Zorunlu ondalık alanlar için; null gelmeyeceği bilinen kolonlarda kullanılır. */
export function numOr(v: DecimalLike, varsayilan = 0): number {
  return num(v) ?? varsayilan;
}

export function iso(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

/** `@db.Date` kolonları için saat bilgisi olmadan `YYYY-MM-DD`. */
export function gun(v: Date | null | undefined): string | null {
  return v ? v.toISOString().slice(0, 10) : null;
}
