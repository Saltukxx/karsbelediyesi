import { ok, panelRoute } from "@/lib/api-route";
import { kontrolFormuDetay } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Kalem × periyot matrisi ve mevcut sonuçlar (yazdırma/doldurma ekranı verisi). */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await kontrolFormuDetay(actor, id)));
}
