import type { GorevDurum } from "@kars/db";

const ALLOWED: Record<GorevDurum, GorevDurum[]> = {
  PLANLANDI: ["DEVAM_EDIYOR", "IPTAL_EDILDI"],
  DEVAM_EDIYOR: ["TAMAMLANDI", "IPTAL_EDILDI"],
  TAMAMLANDI: [],
  IPTAL_EDILDI: [],
};

export function canTransitionTask(
  from: GorevDurum,
  to: GorevDurum,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };
  if (ALLOWED[from]?.includes(to)) return { ok: true };
  return { ok: false, error: `Görev ${from} → ${to} geçişi geçersiz` };
}

export function validateKmPair(
  kmCikis: number | null | undefined,
  kmGiris: number | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (kmCikis == null || kmGiris == null) return { ok: true };
  if (kmGiris < kmCikis) {
    return { ok: false, error: "Giriş KM, çıkış KM'den küçük olamaz" };
  }
  return { ok: true };
}
