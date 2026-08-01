import { ok, panelRoute } from "@/lib/api-route";
import { ACTION_ROLES } from "@/lib/authz";
import { rolGerekli } from "@/lib/services/base";
import { slaTaramasiCalistir } from "@/lib/sla-notify";

export const dynamic = "force-dynamic";

/**
 * SLA taramasını elle tetikler. Bildirim uçları taramayı kendiliğinden
 * çalıştırır; bu uç dış zamanlayıcı (cron) ve yönetici tetiklemesi içindir.
 * `?zorla=1` 10 dakikalık kısıtlamayı atlar.
 */
export async function POST(req: Request) {
  const zorla = new URL(req.url).searchParams.get("zorla") === "1";
  return panelRoute(req, async (actor) => {
    rolGerekli(actor, ACTION_ROLES.komuta);
    return ok(await slaTaramasiCalistir({ zorla }));
  });
}
