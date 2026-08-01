import { ok, panelRoute } from "@/lib/api-route";
import { exportKatalogu } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** Excel dışa aktarma kataloğu; her kalem için rol izni de döner */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(exportKatalogu(actor)));
}
