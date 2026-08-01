import { ok, panelRoute, readJson } from "@/lib/api-route";
import { kontrolFormuOnayaGonder } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Taslak formu onaya gönderir; onaylayanlara bildirim düşer. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const submission = await kontrolFormuOnayaGonder(actor, id, await readJson(req));
    return ok({
      id: submission.id,
      durum: submission.durum,
      teknisyenAdi: submission.teknisyenAdi,
      sefAmirAdi: submission.sefAmirAdi,
    });
  });
}
