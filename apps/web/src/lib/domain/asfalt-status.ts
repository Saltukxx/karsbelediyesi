import type { AsfaltDurum } from "@kars/db";

const ALLOWED: Record<AsfaltDurum, AsfaltDurum[]> = {
  PLANLANDI: ["DEVAM_EDIYOR", "TAMAMLANDI"],
  DEVAM_EDIYOR: ["PLANLANDI", "TAMAMLANDI"],
  TAMAMLANDI: ["DEVAM_EDIYOR"],
};

/** TAMAMLANDI'dan geri dönüşü yalnız bu roller yapabilir */
const GERI_ALABILEN = ["ADMIN", "DEPARTMENT_MANAGER"];

export function canTransitionAsfalt(
  from: AsfaltDurum,
  to: AsfaltDurum,
  role: string,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };
  if (!ALLOWED[from]?.includes(to)) {
    return { ok: false, error: `Asfalt rotası ${from} → ${to} geçişi geçersiz` };
  }
  if (from === "TAMAMLANDI" && !GERI_ALABILEN.includes(role)) {
    return {
      ok: false,
      error: "Tamamlanan rota yeniden açılamaz; müdürlüğünüzle iletişime geçin",
    };
  }
  return { ok: true };
}
