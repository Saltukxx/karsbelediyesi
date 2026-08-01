import { ok, panelRoute, readJson } from "@/lib/api-route";
import { asfaltYolGuncelle, asfaltYolSil } from "@/lib/services/harita";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    ok(await asfaltYolGuncelle(actor, id, await readJson(req))),
  );
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await asfaltYolSil(actor, id)));
}
