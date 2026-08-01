import { ok, panelRoute, readJson } from "@/lib/api-route";
import { kontrolFormuOnayla } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Onaylayan kararı: `karar` = ONAYLANDI | REDDEDILDI. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const submission = await kontrolFormuOnayla(actor, id, await readJson(req));
    return ok({
      id: submission.id,
      durum: submission.durum,
      sefAmirAdi: submission.sefAmirAdi,
      onayTarihi: submission.onayTarihi?.toISOString() ?? null,
    });
  });
}
