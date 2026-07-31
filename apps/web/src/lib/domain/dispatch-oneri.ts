import type { DispatchTip } from "@kars/db";

/**
 * ONERILDI durumundaki işler için rota başına tekillik anahtarı.
 * İş sonuçlanınca null'a çekilir; böylece aynı rotaya ikinci bir bekleyen
 * öneri yazılamaz ama geçmiş öneriler saklanmaya devam eder.
 */
export function oneriAnahtari(tip: DispatchTip, routeId: string): string {
  return `${tip}:${routeId}`;
}

/** Prisma unique ihlali aktifOneriAnahtari'ndan mı geliyor? */
export function bekleyenOneriCakismasiMi(err: unknown): boolean {
  if (typeof err !== "object" || err == null) return false;
  if ((err as { code?: string }).code !== "P2002") return false;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const alanlar = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return alanlar.includes("aktifOneriAnahtari");
}
