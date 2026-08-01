import { ok, panelRoute, readJson } from "@/lib/api-route";
import { islerimSikayetDetay, islerimSikayetDurum } from "@/lib/services/islerim";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Atanan şikayetin detayı + WhatsApp konuşma geçmişi. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await islerimSikayetDetay(actor, id)));
}

/** Saha personelinin kendi şikayetinde durum güncellemesi. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const guncel = await islerimSikayetDurum(actor, id, await readJson(req));
    return ok({
      id: guncel.id,
      sikayetNo: guncel.sikayetNo,
      durum: guncel.durum,
      cozumNotu: guncel.cozumNotu,
      kapanisTarihi: guncel.kapanisTarihi?.toISOString() ?? null,
    });
  });
}
