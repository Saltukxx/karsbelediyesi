import { ok, panelRoute } from "@/lib/api-route";
import { bildirimListesi } from "@/lib/services/notifications";
import { slaTaramasiCalistir } from "@/lib/sla-notify";

export const dynamic = "force-dynamic";

/**
 * Bildirim kutusu. Web'deki zil gibi burada da SLA taraması tetiklenir
 * (kendi içinde 10 dakikaya kısıtlı), böylece ayrı cron gerekmez.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return panelRoute(req, async (actor) => {
    await slaTaramasiCalistir();
    return ok(
      await bildirimListesi(actor, {
        limit: q.get("limit"),
        okunmamis: q.get("okunmamis"),
      }),
    );
  });
}
