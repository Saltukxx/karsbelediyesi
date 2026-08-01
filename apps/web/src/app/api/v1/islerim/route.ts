import { ok, panelRoute } from "@/lib/api-route";
import { islerimOzeti } from "@/lib/services/islerim";

export const dynamic = "force-dynamic";

/** Kullanıcıya atanan işler: araç görevleri, şikayetler, asfalt rotaları. */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await islerimOzeti(actor)));
}
