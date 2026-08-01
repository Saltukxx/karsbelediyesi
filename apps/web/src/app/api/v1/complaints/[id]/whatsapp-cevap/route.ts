import { created, panelRoute, readJson } from "@/lib/api-route";
import { whatsappCevapla } from "@/lib/services/whatsapp";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Web `whatsappCevapGonder` formunun JSON karşılığı (İşlerim ekranı). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) =>
    created(await whatsappCevapla(actor, id, await readJson(req))),
  );
}
