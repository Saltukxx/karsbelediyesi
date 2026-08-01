import { ok, panelRoute, readJson } from "@/lib/api-route";
import { copRotaGuncelle, copRotaSil } from "@/lib/services/cop";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    ok(await copRotaGuncelle(actor, id, await readJson(req))),
  );
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await copRotaSil(actor, id)));
}
