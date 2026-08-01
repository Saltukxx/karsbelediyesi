import { ok, panelRoute } from "@/lib/api-route";
import { raporOzeti } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** SLA kovaları, geciken acil şikayetler, müdürlük KPI'ı ve genel toplamlar */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await raporOzeti(actor)));
}
