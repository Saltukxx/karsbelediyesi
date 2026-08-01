import { ok, panelRoute } from "@/lib/api-route";
import { gorevTakipRaporu, gorevYenidenAnalizEt } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GPS izi sonradan geldiğinde raporu yeniden üretir; güncel raporu döner. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    await gorevYenidenAnalizEt(actor, id);
    return ok(await gorevTakipRaporu(actor, id));
  });
}
