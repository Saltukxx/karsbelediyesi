import { ok, panelRoute, readJson } from "@/lib/api-route";
import { islerimAsfaltDurum } from "@/lib/services/islerim";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Saha personelinin kendisine atanan asfalt rotasında durum güncellemesi. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const guncel = await islerimAsfaltDurum(actor, id, await readJson(req));
    return ok({ id: guncel.id, ad: guncel.ad, durum: guncel.durum });
  });
}
