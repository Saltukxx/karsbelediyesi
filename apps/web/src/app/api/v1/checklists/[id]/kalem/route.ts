import { ok, panelRoute, readJson } from "@/lib/api-route";
import { kontrolKalemKaydet } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tek kontrol kalemini kaydeder. ARIZALI sonucu otomatik bakım kaydı açar;
 * yanıttaki `bakimKaydiId` bu kaydı gösterir.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    ok(await kontrolKalemKaydet(actor, id, await readJson(req))),
  );
}
