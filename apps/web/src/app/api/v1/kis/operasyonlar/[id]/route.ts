import { ok, panelRoute } from "@/lib/api-route";
import { kisOperasyonSil } from "@/lib/services/kis";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await kisOperasyonSil(actor, id)));
}
