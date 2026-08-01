import { ok, panelRoute, readJson } from "@/lib/api-route";
import { temizlikRotaGuncelle, temizlikRotaSil } from "@/lib/services/temizlik";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    ok(await temizlikRotaGuncelle(actor, id, await readJson(req))),
  );
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await temizlikRotaSil(actor, id)));
}
