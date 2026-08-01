import { ok, panelRoute } from "@/lib/api-route";
import { isMaliyetiRaporu } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** Kapanan görevlerin maliyet kırılımı; `gun` verilmezse son 30 gün */
export async function GET(req: Request) {
  const gun = new URL(req.url).searchParams.get("gun") ?? undefined;
  return panelRoute(req, async (actor) => ok(await isMaliyetiRaporu(actor, { gun })));
}
