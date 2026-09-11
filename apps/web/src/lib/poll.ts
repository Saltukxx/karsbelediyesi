/**
 * Web yoklama aralığına rastgele sapma — iOS KBPoll ile aynı fikir.
 * Sabit setInterval istemcileri mesai başında senkron tepe yük oluşturur;
 * her turda aralığı kaydırmak istemcileri ayırır.
 */
export const POLL_SAPMA = { min: 0.75, max: 1.25 } as const;

export function jitteredIntervalMs(baseMs: number): number {
  const f =
    POLL_SAPMA.min + Math.random() * (POLL_SAPMA.max - POLL_SAPMA.min);
  return Math.max(1_000, Math.round(baseMs * f));
}

/**
 * Görünürken yaklaşık `baseMs` aralıkla `tick` çağırır (jitter'lı setTimeout zinciri).
 * İlk yükleme çağıranın sorumluluğundadır — bu yardımcı yalnızca tazelemeyi yönetir.
 * Sekme gizlenince zamanlayıcı durur; görünür olunca hemen bir tick + yeniden planlama.
 */
export function startVisibilityPoll(
  tick: () => void | Promise<void>,
  baseMs: number,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const planla = () => {
    if (cancelled) return;
    timeoutId = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          try {
            await tick();
          } catch {
            /* geçici ağ hatalarında sonraki tur dener */
          }
        }
        planla();
      })();
    }, jitteredIntervalMs(baseMs));
  };

  const onVis = () => {
    if (document.visibilityState !== "visible" || cancelled) return;
    void (async () => {
      try {
        await tick();
      } catch {
        /* ignore */
      }
    })();
  };

  planla();
  document.addEventListener("visibilitychange", onVis);

  return () => {
    cancelled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    document.removeEventListener("visibilitychange", onVis);
  };
}
