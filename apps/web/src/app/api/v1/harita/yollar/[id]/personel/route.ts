import { ok, panelRoute, readJson } from "@/lib/api-route";
import { asfaltPersonelAta } from "@/lib/services/harita";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Rota personelini tümüyle yeniden yazar (web'in çoklu seçim formu). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    ok(await asfaltPersonelAta(actor, id, await readJson(req))),
  );
}
