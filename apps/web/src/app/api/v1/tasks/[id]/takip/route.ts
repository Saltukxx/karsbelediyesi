import { ok, panelRoute } from "@/lib/api-route";
import { gorevTakipRaporu } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Rota takip raporu: metrikler, sapma/duraklama/boşluk listeleri, harita izleri. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await gorevTakipRaporu(actor, id)));
}
