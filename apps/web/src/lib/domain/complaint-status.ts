import type { Rol } from "@kars/shared";
import type { SikayetDurum } from "@kars/db";

const OPEN: SikayetDurum[] = ["ACIK", "DEVAM_EDIYOR"];
const CLOSED: SikayetDurum[] = ["KAPATILDI", "IPTAL"];

export function canTransitionComplaint(
  from: SikayetDurum,
  to: SikayetDurum,
  role: Rol | string,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };

  if (CLOSED.includes(from)) {
    if (role === "ADMIN" && OPEN.includes(to)) return { ok: true };
    return { ok: false, error: "Kapalı şikayet yalnızca ADMIN tarafından yeniden açılabilir" };
  }

  if (OPEN.includes(from) && (OPEN.includes(to) || CLOSED.includes(to))) {
    return { ok: true };
  }

  return { ok: false, error: "Geçersiz durum geçişi" };
}
