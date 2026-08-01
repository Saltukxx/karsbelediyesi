import { ok, panelRoute } from "@/lib/api-route";
import { copToplamaSil } from "@/lib/services/cop";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await copToplamaSil(actor, id)));
}
